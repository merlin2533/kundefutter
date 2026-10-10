// Baut die abrufbare URL für einen gespeicherten Beleg-Pfad — client-seitiges Pendant zu
// resolveUploadPath() (lib/upload.ts, das fs/path importiert und deshalb server-only bleiben
// muss). Zwei Pfad-Formen sind im Projekt im Umlauf: alte Pfade liegen bereits unter
// public/uploads/ und beginnen mit "/uploads/" (z.B. Ausgabe.belegPfad) — die liefert Next
// direkt statisch aus, ohne API-Umweg. Neue relative Pfade (z.B. EingangsRechnung.belegpfad,
// "eingangsrechnungen/datei.pdf") liegen außerhalb von public/ und müssen über die generische
// Datei-Route /api/uploads/[...path] ausgeliefert werden. Bewusst importfrei, damit es sowohl
// in Client- als auch in Server-Komponenten verwendbar ist.
export function belegUrl(pfad: string | null | undefined): string | null {
  if (!pfad) return null;
  if (pfad.startsWith("/uploads/") || pfad.startsWith("http://") || pfad.startsWith("https://")) return pfad;
  return `/api/uploads/${pfad.replace(/^\//, "")}`;
}

/** Dateiendung (klein geschrieben, ohne Punkt) aus einem Pfad/einer URL, z.B. "pdf". */
export function belegDateiendung(pfad: string): string {
  const ohneQuery = pfad.split(/[?#]/)[0];
  const teile = ohneQuery.split(".");
  return teile.length > 1 ? teile[teile.length - 1].toLowerCase() : "";
}

export const BELEG_BILD_ENDUNGEN = new Set(["jpg", "jpeg", "png", "webp"]);
