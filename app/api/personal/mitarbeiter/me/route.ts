import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";

export const dynamic = "force-dynamic";

/**
 * Selbstbedienungs-sichere Variante von GET /api/personal/mitarbeiter/[id]: liefert NUR die für
 * die eigene Arbeitszeiterfassung nötigen, unsensiblen Felder des mit diesem Login verknüpften
 * Mitarbeiter-Datensatzes — bewusst OHNE Gehalt/IBAN/Kostenstelle/Notiz. Erfordert eine bestehende
 * Verknüpfung (Benutzer.mitarbeiterId); ohne Verknüpfung 404 (weder Selbstbedienung noch normaler
 * Account hat hier etwas zu sehen — normale Accounts nutzen die volle /mitarbeiter/[id]-Route).
 */
export async function GET() {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "personal");
  if (denyModul) return denyModul;
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!me.mitarbeiterId) {
    return NextResponse.json({ error: "Kein verknüpfter Mitarbeiter-Datensatz" }, { status: 404 });
  }

  try {
    const mitarbeiter = await prisma.mitarbeiter.findUnique({
      where: { id: me.mitarbeiterId },
      select: {
        id: true,
        vorname: true,
        nachname: true,
        aktiv: true,
        wochenstunden: true,
        bevorzugteArbeitszeiten: true,
      },
    });
    if (!mitarbeiter) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(mitarbeiter);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}
