import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
import { KI_MODELLE, KiAuswahlKategorie } from "@/lib/ki-modelle";
export const dynamic = "force-dynamic";

// Einstellungs-Keys, deren Wert nur aus dem zentralen Modell-Katalog
// (lib/ki-modelle.ts) stammen darf — leer ist erlaubt (fällt serverseitig
// sauber auf den Standardwert der Kategorie zurück, siehe getAiConfig()).
const MODELL_KATEGORIE_JE_KEY: Record<string, KiAuswahlKategorie> = {
  "ki.modell_language": "language",
  "ki.modell_transcription": "transcription",
};

const ALLOWED_PREFIXES = [
  "firma.",
  "system.",
  "ki.",
  "datev.",
  "ausgaben.",
  "bankabgleich.",
  "dokument.",
  "smtp.",
  "letzte_",
  "dashboard.",
  "email.",
  "resend.",
  "alert.",
  "artikel.",
  "cron.",
  "modul.",
  "sicherheit.",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prefix = searchParams.get("prefix") ?? "firma.";
  if (!ALLOWED_PREFIXES.some((p) => prefix.startsWith(p) || p.startsWith(prefix))) {
    return NextResponse.json({ error: "Prefix nicht erlaubt" }, { status: 400 });
  }

  try {
    const einstellungen = await prisma.einstellung.findMany({
      where: { key: { startsWith: prefix } },
      take: 100,
    });
    const result: Record<string, string> = {};
    for (const e of einstellungen) {
      // API-Keys maskieren
      if (e.key.endsWith("_key") && e.value) {
        result[e.key] = e.value.length > 8
          ? e.value.slice(0, 7) + "..." + e.value.slice(-4)
          : "***";
      } else {
        result[e.key] = e.value;
      }
    }
    // Nicht aus dem Browser-Cache bedienen – sonst zeigt die Einstellungsseite
    // nach dem Speichern beim Neuladen veraltete Werte (z.B. Checkbox-Zustände).
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EINSTELLUNGEN_BEARBEITEN);
  if (deny) return deny;

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { key, value } = body as { key: string; value: string };
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key und value erforderlich" }, { status: 400 });
  }
  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return NextResponse.json({ error: `Nur Einstellungen mit Prefix ${ALLOWED_PREFIXES.join(", ")} sind erlaubt` }, { status: 400 });
  }
  // Leere Key-Werte nicht überschreiben (verhindert versehentliches Löschen)
  if (key.endsWith("_key") && !value) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // KI-Modellauswahl: nur Werte aus dem zentralen Katalog erlauben (leer = ok,
  // fällt dann auf den Standardwert der Kategorie zurück)
  const modellKategorie = MODELL_KATEGORIE_JE_KEY[key];
  if (modellKategorie && value && !KI_MODELLE[modellKategorie].some((m) => m.value === value)) {
    return NextResponse.json({ error: "Ungültiges KI-Modell für diese Kategorie" }, { status: 400 });
  }

  try {
    const einstellung = await prisma.einstellung.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return NextResponse.json(einstellung);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Speichern der Einstellung" }, { status: 500 });
  }
}
