/**
 * Zentrale Quelle der Wahrheit für die GlitchTip-DSN.
 *
 * WICHTIG — dieses Modul muss importfrei bleiben:
 * Es wird von `sentry.server.config.ts`, `sentry.edge.config.ts`,
 * `instrumentation-client.ts` (Browser-Bundle!) UND von `next.config.ts`
 * (Node, außerhalb des Next-Bundles) genutzt. Jeder Import auf `next/*`,
 * `@/lib/auth`, `prisma` o.ä. würde eine dieser vier Umgebungen brechen.
 *
 * Die DSN ist bewusst fest im Code hinterlegt, damit JEDER Container dieses
 * Images ohne zusätzliche Konfiguration an GlitchTip meldet. Ein DSN ist kein
 * Geheimnis: er liegt bei jeder Web-App offen im Browser-Bundle und erlaubt
 * ausschließlich das Einsenden von Events, nicht das Lesen.
 *
 * Übersteuern/abschalten:
 *   SENTRY_DSN=<andere-dsn>       → Server/Edge melden dorthin
 *   NEXT_PUBLIC_SENTRY_DSN=<dsn>  → zusätzlich der Browser (Build-Zeit!)
 *   SENTRY_DSN=off                → Reporting komplett aus
 */

export const DEFAULT_SENTRY_DSN =
  "https://3a30aed56b4e4dd58ee5710244be23dc@glitchtip.resqio.io/2";

/** Werte, die das Reporting bewusst abschalten (case-insensitiv). */
const AUS_WERTE = new Set(["off", "none", "false", "0", "disabled", "aus"]);

export type DsnHerkunft = "env" | "default" | "off";

export type DsnTeile = {
  key: string;
  host: string;
  projectId: string;
};

/**
 * Zerlegt eine Sentry/GlitchTip-DSN in ihre Bestandteile.
 * Gibt `null` zurück, wenn der Wert keine gültige DSN ist.
 */
export function parseDsn(dsn: string | undefined | null): DsnTeile | null {
  if (!dsn) return null;
  const treffer = /^https?:\/\/([^@/]+)@([^/]+)\/(.+)$/.exec(dsn.trim());
  if (!treffer) return null;
  const [, key, host, projectId] = treffer;
  if (!key || !host || !projectId) return null;
  return { key, host, projectId };
}

/**
 * Auflösung der effektiven DSN.
 *
 * Reihenfolge: expliziter Wert (bzw. SENTRY_DSN, dann NEXT_PUBLIC_SENTRY_DSN)
 * → `DEFAULT_SENTRY_DSN`. Ein Abschalt-Wert (`off`, `none`, …) ergibt `""`.
 *
 * `process.env.*` wird hier absichtlich einzeln und statisch gelesen (nicht
 * über eine Schleife oder dynamische Keys) — nur so kann Next.js die
 * `NEXT_PUBLIC_`-Variable beim Build ins Client-Bundle inlinen.
 */
export function resolveSentryDsn(explizit?: string): string {
  // Erster nicht-leerer Wert gewinnt. Bewusst nicht `??`: Docker-Compose setzt
  // `SENTRY_DSN=` als LEEREN String (nicht undefined), der darf nicht gewinnen.
  const kandidat = ersterWert(
    explizit,
    process.env.SENTRY_DSN,
    process.env.NEXT_PUBLIC_SENTRY_DSN
  );

  if (!kandidat) return DEFAULT_SENTRY_DSN;
  if (AUS_WERTE.has(kandidat.toLowerCase())) return "";
  return kandidat;
}

/** Erster Wert, der nach dem Trimmen nicht leer ist. */
function ersterWert(...werte: (string | undefined)[]): string {
  for (const wert of werte) {
    const getrimmt = (wert ?? "").trim();
    if (getrimmt) return getrimmt;
  }
  return "";
}

/**
 * Nur für den Browser: `process.env.SENTRY_DSN` existiert im Client-Bundle
 * nicht, deshalb wird dort ausschließlich die `NEXT_PUBLIC_`-Variante gelesen.
 */
export function resolveClientSentryDsn(): string {
  const kandidat = (process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim();
  if (!kandidat) return DEFAULT_SENTRY_DSN;
  if (AUS_WERTE.has(kandidat.toLowerCase())) return "";
  return kandidat;
}

/** Woher die effektive DSN stammt — für die Diagnose in /einstellungen/system. */
export function sentryDsnHerkunft(explizit?: string): DsnHerkunft {
  const kandidat = ersterWert(
    explizit,
    process.env.SENTRY_DSN,
    process.env.NEXT_PUBLIC_SENTRY_DSN
  );
  if (!kandidat) return "default";
  if (AUS_WERTE.has(kandidat.toLowerCase())) return "off";
  // Ein explizit gesetzter Wert, der dem eingebackenen Default entspricht, ist
  // für die Diagnose kein "eigenes Projekt" — sonst würde die UI behaupten, das
  // Reporting sei übersteuert, obwohl es der Standard ist.
  return kandidat === DEFAULT_SENTRY_DSN ? "default" : "env";
}

/**
 * Endpunkt für CSP-Verstoßmeldungen (`report-uri`/`report-to`).
 * GlitchTip erwartet den Public-Key als `glitchtip_key`-Query-Parameter.
 * Leerer String, wenn das Reporting abgeschaltet ist.
 */
export function sentrySecurityReportUrl(dsn?: string): string {
  const teile = parseDsn(dsn ?? resolveSentryDsn());
  if (!teile) return "";
  return `https://${teile.host}/api/${teile.projectId}/security/?glitchtip_key=${teile.key}`;
}

/**
 * Klassischer Store-Endpunkt — für Umgebungen ohne SDK (Service Worker,
 * `geo-server.js`, `docker-entrypoint.sh`), die einen rohen POST senden.
 */
export function sentryStoreUrl(dsn?: string): string {
  const teile = parseDsn(dsn ?? resolveSentryDsn());
  if (!teile) return "";
  return `https://${teile.host}/api/${teile.projectId}/store/`;
}
