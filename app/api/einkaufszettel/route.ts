import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const QUELLE_WHITELIST = new Set(["vorbestellung", "lieferung", "angebot"]);

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

// GET /api/einkaufszettel
// Aggregiert offene Auftragspositionen (Vorbestellungen, geplante Lieferungen,
// angenommene Angebote) zum bevorzugten Lieferanten je Artikel und mischt den
// Beschaffungsstatus (EinkaufStatus) ein.
export async function GET() {
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
      prisma.lieferung.findMany({
        where: { status: "geplant" },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } } },
        },
        take: 1000,
      }),
      prisma.angebot.findMany({
        where: { status: "ANGENOMMEN" },
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

    // Bevorzugten Lieferanten je Artikel auflösen
    const artikelIds = Array.from(new Set(quellPositionen.map((q) => q.artikelId)));
    const zuordnungen = await prisma.artikelLieferant.findMany({
      where: { artikelId: { in: artikelIds } },
      include: { lieferant: { select: { id: true, name: true, email: true, telefon: true } } },
      orderBy: [{ bevorzugt: "desc" }, { id: "asc" }],
    });
    const lieferantFuerArtikel = new Map<
      number,
      { id: number; name: string; email: string | null; telefon: string | null; einkaufspreis: number }
    >();
    for (const z of zuordnungen) {
      if (!lieferantFuerArtikel.has(z.artikelId)) {
        lieferantFuerArtikel.set(z.artikelId, {
          id: z.lieferant.id,
          name: z.lieferant.name,
          email: z.lieferant.email,
          telefon: z.lieferant.telefon,
          einkaufspreis: z.einkaufspreis,
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
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/einkaufszettel
// Body: { aktion: "bestellen" | "zuruecksetzen",
//         positionen: [{ quelle, positionId, artikelId, lieferantId?, menge, einheit? }],
//         bestelltAm?, notiz? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const aktion = body?.aktion;
    if (aktion !== "bestellen" && aktion !== "zuruecksetzen") {
      return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
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
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
