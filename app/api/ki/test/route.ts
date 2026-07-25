import { NextRequest, NextResponse } from "next/server";
import { testConnection, getAiConfig } from "@/lib/ai";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// Testet die Mistral-Verbindung ausschließlich mit dem in der DB gespeicherten
// Key (nie mit einem vom Client übermittelten Wert) — GET /api/einstellungen
// maskiert API-Keys in der Anzeige, daher darf ein aus dem Formular
// stammender Key niemals ungeprüft weitergereicht werden. Der Aufrufer muss
// vorher speichern (siehe app/einstellungen/ki/page.tsx handleTest), damit
// ein frisch eingegebener Key hier bereits als aktueller DB-Wert ankommt.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch((err) => {
      Sentry.captureException(err);
      return ({});
    });
    const { modell } = body as Record<string, unknown>;

    const stored = await getAiConfig("language");
    const cfg = {
      modell: (typeof modell === "string" && modell) ? modell : stored.modell,
      mistralKey: stored.mistralKey,
    };

    const result = await testConnection(cfg);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
