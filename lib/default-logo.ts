/**
 * Neutrales Standard-Logo für Neuinstallationen.
 *
 * Wird überall dort als Fallback verwendet, wo (noch) kein individuelles Logo
 * über die Einstellung `system.logo` hinterlegt wurde — Navigation, Favicon
 * und PWA-Icon. Bestehende Installationen mit eigenem Logo bleiben unberührt.
 * Vollständig über Einstellungen › Erscheinungsbild austausch- und hochladbar.
 *
 * Bewusst markenneutral gehalten: stilisiertes Ernte-/Schichten-Symbol in den
 * AGRI-Office-Grüntönen mit Amber-Akzent, mit eigener Hintergrundkachel, damit
 * es auf hellem wie dunklem Untergrund funktioniert.
 */
export const DEFAULT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="AGRI-Office">
  <defs>
    <linearGradient id="ao-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#40916c"/>
      <stop offset="1" stop-color="#1b4332"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#ao-bg)"/>
  <path d="M256 116 L132 180 L256 244 L380 180 Z" fill="#ffffff"/>
  <path d="M132 256 L256 320 L380 256" fill="none" stroke="#f4a261" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M132 332 L256 396 L380 332" fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Data-URI-Variante des Standard-Logos — direkt in `<img src>` (Browser) und in
 * `next/og` `ImageResponse` (Server) verwendbar. Base64-kodiert für maximale
 * Kompatibilität; funktioniert sowohl im Client- als auch im Node-Kontext.
 */
export const DEFAULT_LOGO_DATA_URI =
  "data:image/svg+xml;base64," +
  (typeof Buffer !== "undefined"
    ? Buffer.from(DEFAULT_LOGO_SVG).toString("base64")
    : btoa(DEFAULT_LOGO_SVG));
