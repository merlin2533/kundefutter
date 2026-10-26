import { getCurrentUser } from "@/lib/auth";
import { P, requirePermission, requireAnyPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBevorzugtenLieferanten } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const QUELLE_WHITELIST = new Set(["vorbestellung", "lieferung", "angebot"]);

// Wirft `UebernahmeFehler`, um aus der $transaction in POST (aktion "uebernehmen") früh mit
// einer sprechenden, erwarteten Fehlermeldung + eigenem Statuscode auszusteigen — ohne dass
// das wie ein unerwarteter Fehler an Sentry gemeldet wird (siehe catch-Block dort).
class UebernahmeFehler extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Vorbestellungs-Nummern, die in eine Bestellliste-Position übernommen wurden, stehen als
// einzige Quelle der Wahrheit in deren `notiz` — damit eine zweite Übernahme (neue Vorbestellung
// für denselben Lieferanten+Artikel, siehe POST) weiß, was schon drinsteckt, statt eine
// Nummer doppelt aufzulisten oder zu überschreiben.
function baueVorbestellungsNotiz(nummern: string[]): string {
  return `Aus Vorbestellungen: ${nummern.join(", ")}`;
}
function extrahiereVorbestellungsNummern(notiz: string | null): string[] {
  if (!notiz) return [];
  const match = notiz.match(/^Aus Vorbestellungen: (.+)$/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

interface QuellPosition {
  quelle: "vorbestellung" | "lieferung" | "angebot";
  positionId: number;
  belegId: number;
  belegNummer: string;
  belegTyp: string;
  kunde: { id: number; name: string; firma: string | null } | null;
  artikelId: number;
  artikelName: string;
  artikelnummer: string;
  einheit: string;
  menge: number;
  bestelltAm: string | null;
}

// GET /api/einkaufszettel?quelle=vorbestellung
// Aggregiert offene Auftragspositionen (Vorbestellungen, geplante Lieferungen,
// angenommene Angebote) zum bevorzugten Lieferanten je Artikel und mischt den
// Beschaffungsstatus (EinkaufStatus) ein. `?quelle=vorbestellung` blendet die beiden
// anderen, deutlich häufigeren Quellen komplett aus — für die Saison-Sammelbestellung
// (viele Vorbestellungen, ein Lieferant, ein Termin) wäre die gemischte Ansicht sonst
// zu unübersichtlich, um sie gezielt in die Bestellliste zu übernehmen (siehe POST unten).
export async function GET(req: NextRequest) {
  const quelleFilter = new URL(req.url).searchParams.get("quelle");
  const nurVorbestellungen = quelleFilter === "vorbestellung";
  try {
    const [vorbestellungen, lieferungen, angebote] = await Promise.all([
      prisma.vorbestellung.findMany({
        where: { status: { in: ["OFFEN", "BESTAETIGT"] } },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true } } } },
        },
        take: 1000,
      }),
      // `where: { id: -1 }` statt eines eigenen Promise.resolve([])-Zweigs — behält für
      // beide Fälle denselben Rückgabetyp (inkl. include) und ist auf der Primärschlüssel-
      // Spalte faktisch kostenlos, kein echter Tabellenscan.
      prisma.lieferung.findMany({
        where: nurVorbestellungen ? { id: -1 } : { status: "geplant" },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } } },
        },
        take: 1000,
      }),
      prisma.angebot.findMany({
        where: nurVorbestellungen ? { id: -1 } : { status: "ANGENOMMEN" },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true } } } },
        },
        take: 1000,
      }),
    ]);

    const quellPositionen: QuellPosition[] = [];

    for (const vb of vorbestellungen) {
      for (const p of vb.positionen) {
        quellPositionen.push({
          quelle: "vorbestellung",
          positionId: p.id,
          belegId: vb.id,
          belegNummer: vb.nummer,
          belegTyp: "Vorbestellung",
          kunde: vb.kunde,
          artikelId: p.artikelId,
          artikelName: p.artikel.name,
          artikelnummer: p.artikel.artikelnummer,
          einheit: p.einheit,
          menge: p.menge,
          bestelltAm: null,
        });
      }
    }
    for (const lf of lieferungen) {
      for (const p of lf.positionen) {
        quellPositionen.push({
          quelle: "lieferung",
          positionId: p.id,
          belegId: lf.id,
          belegNummer: `Lieferung #${lf.id}`,
          belegTyp: "Lieferung",
          kunde: lf.kunde,
          artikelId: p.artikelId,
          artikelName: p.artikel.name,
          artikelnummer: p.artikel.artikelnummer,
          einheit: p.artikel.einheit ?? "kg",
          menge: p.menge,
          bestelltAm: null,
        });
      }
    }
    for (const an of angebote) {
      for (const p of an.positionen) {
        quellPositionen.push({
          quelle: "angebot",
          positionId: p.id,
          belegId: an.id,
          belegNummer: an.nummer,
          belegTyp: "Angebot",
          kunde: an.kunde,
          artikelId: p.artikelId,
          artikelName: p.artikel.name,
          artikelnummer: p.artikel.artikelnummer,
          einheit: p.einheit,
          menge: p.menge,
          bestelltAm: null,
        });
      }
    }

    if (quellPositionen.length === 0) return NextResponse.json([]);

    // Beschaffungsstatus einmischen
    const statusFuer = async (quelle: string, ids: number[]) =>
      ids.length === 0
        ? []
        : prisma.einkaufStatus.findMany({ where: { quelle, positionId: { in: ids } } });

    const [stVb, stLf, stAn] = await Promise.all([
      statusFuer("vorbestellung", quellPositionen.filter((q) => q.quelle === "vorbestellung").map((q) => q.positionId)),
      statusFuer("lieferung", quellPositionen.filter((q) => q.quelle === "lieferung").map((q) => q.positionId)),
      statusFuer("angebot", quellPositionen.filter((q) => q.quelle === "angebot").map((q) => q.positionId)),
    ]);
    const statusMap = new Map<string, Date>();
    for (const s of [...stVb, ...stLf, ...stAn]) statusMap.set(`${s.quelle}:${s.positionId}`, s.bestelltAm);
    for (const q of quellPositionen) {
      const am = statusMap.get(`${q.quelle}:${q.positionId}`);
      if (am) q.bestelltAm = am.toISOString();
    }

    // Bevorzugten Lieferanten je Artikel auflösen — bevorzugt NUR wenn dort auch ein Preis
    // gepflegt ist, sonst irgendeiner MIT Preis, sonst bevorzugt/erster auch ohne Preis
    // (resolveBevorzugtenLieferanten(), siehe lib/utils.ts). Reine `bevorzugt desc, id asc`-
    // Sortierung + erster Treffer verdeckte sonst einen anderen, tatsächlich gepflegten EK.
    const artikelIds = Array.from(new Set(quellPositionen.map((q) => q.artikelId)));
    const zuordnungen = await prisma.artikelLieferant.findMany({
      where: { artikelId: { in: artikelIds } },
      include: { lieferant: { select: { id: true, name: true, email: true, telefon: true } } },
    });
    const zuordnungenNachArtikel = new Map<number, typeof zuordnungen>();
    for (const z of zuordnungen) {
      if (!zuordnungenNachArtikel.has(z.artikelId)) zuordnungenNachArtikel.set(z.artikelId, []);
      zuordnungenNachArtikel.get(z.artikelId)!.push(z);
    }
    const lieferantFuerArtikel = new Map<
      number,
      { id: number; name: string; email: string | null; telefon: string | null; einkaufspreis: number }
    >();
    for (const [artikelId, liste] of zuordnungenNachArtikel) {
      const gewaehlt = resolveBevorzugtenLieferanten(liste);
      if (gewaehlt) {
        lieferantFuerArtikel.set(artikelId, {
          id: gewaehlt.lieferant.id,
          name: gewaehlt.lieferant.name,
          email: gewaehlt.lieferant.email,
          telefon: gewaehlt.lieferant.telefon,
          einkaufspreis: gewaehlt.einkaufspreis,
        });
      }
    }

    // Gruppieren: Lieferant → Artikel-Zeile → Positionen
    interface Zeile {
      artikelId: number;
      artikelName: string;
      artikelnummer: string;
      einheit: string;
      einkaufspreis: number;
      gesamtMenge: number;
      offeneMenge: number;
      bestelltMenge: number;
      positionen: QuellPosition[];
    }
    interface Gruppe {
      lieferantId: number;
      lieferantName: string;
      lieferant: { email: string | null; telefon: string | null };
      zeilen: Map<number, Zeile>;
    }
    const gruppen = new Map<number, Gruppe>();

    for (const q of quellPositionen) {
      const lief = lieferantFuerArtikel.get(q.artikelId);
      const lieferantId = lief?.id ?? 0;
      let g = gruppen.get(lieferantId);
      if (!g) {
        g = {
          lieferantId,
          lieferantName: lief?.name ?? "Kein Lieferant zugeordnet",
          lieferant: { email: lief?.email ?? null, telefon: lief?.telefon ?? null },
          zeilen: new Map(),
        };
        gruppen.set(lieferantId, g);
      }
      let z = g.zeilen.get(q.artikelId);
      if (!z) {
        z = {
          artikelId: q.artikelId,
          artikelName: q.artikelName,
          artikelnummer: q.artikelnummer,
          einheit: q.einheit,
          einkaufspreis: lief?.einkaufspreis ?? 0,
          gesamtMenge: 0,
          offeneMenge: 0,
          bestelltMenge: 0,
          positionen: [],
        };
        g.zeilen.set(q.artikelId, z);
      }
      z.gesamtMenge += q.menge;
      if (q.bestelltAm) z.bestelltMenge += q.menge;
      else z.offeneMenge += q.menge;
      z.positionen.push(q);
    }

    const ergebnis = Array.from(gruppen.values())
      .map((g) => {
        const zeilen = Array.from(g.zeilen.values()).sort((a, b) => a.artikelName.localeCompare(b.artikelName, "de"));
        const einkaufswertOffen = zeilen.reduce((s, z) => s + z.offeneMenge * z.einkaufspreis, 0);
        return {
          lieferantId: g.lieferantId,
          lieferantName: g.lieferantName,
          lieferant: g.lieferant,
          einkaufswertOffen,
          zeilen,
        };
      })
      .sort((a, b) => {
        // "Kein Lieferant" ans Ende
        if (a.lieferantId === 0) return 1;
        if (b.lieferantId === 0) return -1;
        return a.lieferantName.localeCompare(b.lieferantName, "de");
      });

    return NextResponse.json(ergebnis);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/einkaufszettel
// Body: { aktion: "bestellen" | "zuruecksetzen",
//         positionen: [{ quelle, positionId, artikelId, lieferantId?, menge, einheit? }],
//         bestelltAm?, notiz? }
//      | { aktion: "uebernehmen", lieferantId, artikelId }
export async function POST(req: NextRequest) {
  const __me = await getCurrentUser();
  const __deny = requireAnyPermission(__me, [P.BESTELLUNGEN_ERSTELLEN, P.LAGER_WARENEINGANG]);
  if (__deny) return __deny;
  try {
    const body = await req.json();
    const aktion = body?.aktion;
    if (aktion !== "bestellen" && aktion !== "zuruecksetzen" && aktion !== "uebernehmen") {
      return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
    }

    if (aktion === "uebernehmen") {
      // Legt eine Bestellliste-Position an (oder addiert auf eine bestehende, noch nicht zu
      // einer formellen Bestellung gebündelte) und markiert dabei atomar alle noch offenen
      // VorbestellungPositionen dieses Artikels als übernommen. Bewusst NUR Quelle
      // "vorbestellung" — anders als "bestellen"/"zuruecksetzen" oben, die reine Haken-Markierung
      // sind, legt dies einen echten Bestellliste-Eintrag an; dafür ist "Alles bestellen"
      // (LAGER_WARENEINGANG reicht dort) zu schwach, hier gilt dieselbe engere Berechtigung wie
      // beim manuellen Erfassen in POST /api/bestellliste.
      const __deny2 = requirePermission(__me, P.BESTELLUNGEN_ERSTELLEN);
      if (__deny2) return __deny2;

      const lieferantId = parseInt(String(body?.lieferantId), 10);
      const artikelId = parseInt(String(body?.artikelId), 10);
      if (isNaN(lieferantId) || isNaN(artikelId)) {
        return NextResponse.json({ error: "Ungültige lieferantId/artikelId" }, { status: 400 });
      }

      try {
        const ergebnis = await prisma.$transaction(async (tx) => {
          // Lieferant serverseitig gegen den aktuell aufgelösten bevorzugten Lieferanten
          // prüfen (identische Logik wie in GET) — verhindert, dass ein zwischenzeitlich
          // geänderter Lieferant die Menge beim falschen Bestellliste-Eintrag einsortiert.
          const zuordnungen = await tx.artikelLieferant.findMany({
            where: { artikelId },
            include: { lieferant: { select: { id: true, name: true } } },
          });
          const bevorzugt = resolveBevorzugtenLieferanten(zuordnungen);
          if (!bevorzugt || bevorzugt.lieferant.id !== lieferantId) {
            throw new UebernahmeFehler(
              "Der zugeordnete Lieferant für diesen Artikel hat sich geändert — bitte Seite neu laden.",
              409
            );
          }

          const kandidaten = await tx.vorbestellungPosition.findMany({
            where: { artikelId, vorbestellung: { status: { in: ["OFFEN", "BESTAETIGT"] } } },
            include: { vorbestellung: { select: { nummer: true } } },
          });
          if (kandidaten.length === 0) {
            throw new UebernahmeFehler("Keine offenen Vorbestellungen für diesen Artikel.", 404);
          }
          const bereits = await tx.einkaufStatus.findMany({
            where: { quelle: "vorbestellung", positionId: { in: kandidaten.map((k) => k.id) } },
            select: { positionId: true },
          });
          const bereitsSet = new Set(bereits.map((b) => b.positionId));
          const offen = kandidaten.filter((k) => !bereitsSet.has(k.id));
          if (offen.length === 0) {
            throw new UebernahmeFehler(
              "Alle offenen Vorbestellungen für diesen Artikel sind bereits in der Bestellliste.",
              409
            );
          }

          const summeMenge = offen.reduce((s, p) => s + p.menge, 0);
          const einheit = offen[0].einheit;
          const nummern = Array.from(new Set(offen.map((p) => p.vorbestellung.nummer))).sort();

          // Bereits offene, noch nicht gebündelte Bestellliste-Position für dieselbe
          // Lieferant+Artikel-Kombination? → addieren. Sonst (keine, oder bereits zu einer
          // Bestellung gebündelt/versendet) eine neue anlegen.
          const bestehend = await tx.bestellposition.findFirst({
            where: { lieferantId, artikelId, status: "offen", bestellungId: null },
          });

          let position;
          if (bestehend) {
            const alleNummern = Array.from(
              new Set([...extrahiereVorbestellungsNummern(bestehend.notiz), ...nummern])
            ).sort();
            position = await tx.bestellposition.update({
              where: { id: bestehend.id },
              data: { menge: bestehend.menge + summeMenge, notiz: baueVorbestellungsNotiz(alleNummern) },
            });
          } else {
            const artikel = await tx.artikel.findUnique({ where: { id: artikelId }, select: { einheit: true } });
            const zuordnung = zuordnungen.find((z) => z.lieferantId === lieferantId);
            position = await tx.bestellposition.create({
              data: {
                lieferantId,
                artikelId,
                menge: summeMenge,
                einheit: einheit || artikel?.einheit || "kg",
                einkaufspreis: zuordnung?.einkaufspreis ?? 0,
                notiz: baueVorbestellungsNotiz(nummern),
              },
            });
          }

          await Promise.all(
            offen.map((p) =>
              tx.einkaufStatus.upsert({
                where: { quelle_positionId: { quelle: "vorbestellung", positionId: p.id } },
                create: {
                  quelle: "vorbestellung",
                  positionId: p.id,
                  artikelId,
                  lieferantId,
                  menge: p.menge,
                  einheit: p.einheit,
                  bestelltAm: new Date(),
                  notiz: `Übernommen in Bestellliste-Position #${position.id}`,
                },
                update: {
                  lieferantId,
                  menge: p.menge,
                  einheit: p.einheit,
                  bestelltAm: new Date(),
                  notiz: `Übernommen in Bestellliste-Position #${position.id}`,
                },
              })
            )
          );

          return {
            bestellpositionId: position.id,
            menge: summeMenge,
            einheit: position.einheit,
            anzahlVorbestellungen: nummern.length,
            anzahlPositionen: offen.length,
          };
        });

        return NextResponse.json({ ok: true, ...ergebnis });
      } catch (err) {
        if (err instanceof UebernahmeFehler) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    const positionen = Array.isArray(body?.positionen) ? body.positionen : [];
    if (positionen.length === 0) return NextResponse.json({ error: "Keine Positionen" }, { status: 400 });

    // Validierung + Normalisierung
    const eintraege: {
      quelle: string;
      positionId: number;
      artikelId: number;
      lieferantId: number | null;
      menge: number;
      einheit: string;
    }[] = [];
    for (const p of positionen) {
      const quelle = String(p?.quelle ?? "");
      const positionId = parseInt(String(p?.positionId), 10);
      const artikelId = parseInt(String(p?.artikelId), 10);
      if (!QUELLE_WHITELIST.has(quelle) || isNaN(positionId) || isNaN(artikelId)) {
        return NextResponse.json({ error: "Ungültige Positionsdaten" }, { status: 400 });
      }
      const lieferantId = p?.lieferantId != null && p.lieferantId !== 0 ? parseInt(String(p.lieferantId), 10) : null;
      eintraege.push({
        quelle,
        positionId,
        artikelId,
        lieferantId: lieferantId != null && !isNaN(lieferantId) ? lieferantId : null,
        menge: Number(p?.menge) || 0,
        einheit: typeof p?.einheit === "string" && p.einheit ? p.einheit : "kg",
      });
    }

    if (aktion === "zuruecksetzen") {
      await prisma.$transaction(
        eintraege.map((e) =>
          prisma.einkaufStatus.deleteMany({ where: { quelle: e.quelle, positionId: e.positionId } })
        )
      );
      return NextResponse.json({ ok: true, count: eintraege.length });
    }

    // bestellen → upsert
    const bestelltAm = body?.bestelltAm ? new Date(body.bestelltAm) : new Date();
    const notiz = typeof body?.notiz === "string" && body.notiz.trim() ? body.notiz.trim() : null;
    await prisma.$transaction(
      eintraege.map((e) =>
        prisma.einkaufStatus.upsert({
          where: { quelle_positionId: { quelle: e.quelle, positionId: e.positionId } },
          create: {
            quelle: e.quelle,
            positionId: e.positionId,
            artikelId: e.artikelId,
            lieferantId: e.lieferantId,
            menge: e.menge,
            einheit: e.einheit,
            bestelltAm,
            notiz,
          },
          update: {
            artikelId: e.artikelId,
            lieferantId: e.lieferantId,
            menge: e.menge,
            einheit: e.einheit,
            bestelltAm,
            notiz,
          },
        })
      )
    );
    return NextResponse.json({ ok: true, count: eintraege.length });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
