import type { NextConfig } from "next";
import { randomUUID } from "crypto";
import { version as appVersion } from "./package.json";
import { withSentryConfig } from "@sentry/nextjs";
// Relativer Import (nicht "@/lib/…"): next.config.ts wird außerhalb des
// Next-Bundles geladen, der tsconfig-Alias greift hier nicht zuverlässig.
import { sentrySecurityReportUrl } from "./lib/sentry-dsn";

// Next lädt diese Config mehrfach (Client-/Server-Compile, Worker). Ein
// randomUUID() pro Auswertung würde Client und Server unterschiedliche
// `release`-Werte an GlitchTip melden — daher bevorzugt der Commit-SHA.
const buildId = process.env.GITHUB_SHA?.slice(0, 7) || randomUUID();

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["leaflet", "react-leaflet"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  async headers() {
    // Content-Security-Policy: berücksichtigt bekannte externe Quellen der App:
    // - Leaflet-Karten laden Marker-Icons + CSS von unpkg.com (app/kunden/karte,
    //   app/gebietsanalyse, app/tagesansicht)
    // - OSM-Kartenkacheln (*.tile.openstreetmap.org), QR-Code-Bilder (api.qrserver.com),
    //   Google-Drive-Vorschauen etc. -> über img-src https: pauschal erlaubt
    // - Client-seitige Fetches zu Nominatim (Geocoding) und OSRM (Routing)
    // - Sentry/GlitchTip-Fehlerreporting (dynamischer DSN-Host, daher https: pauschal)
    // Google Fonts werden NUR auf der separaten statischen web/-Landingpage genutzt,
    // nicht in der Next-App (app/layout.tsx bindet keine externen Fonts ein).
    // CSP-Verstöße werden per `report-uri` an GlitchTip gemeldet.
    //
    // ACHTUNG — hier wirkt SENTRY_DSN nur zur BUILD-Zeit: Next wertet
    // `headers()` beim Build aus und schreibt das Ergebnis in
    // `routes-manifest.json`. Ein `SENTRY_DSN=off` im laufenden Container
    // schaltet also Issues und Logs ab, NICHT aber diesen CSP-Report-Endpunkt —
    // dafür muss das Image mit `SENTRY_DSN=off` neu gebaut werden. Betrifft
    // ausschließlich CSP-Verstoßmeldungen (keine Anwendungsdaten).
    //
    // BEWUSST NUR `report-uri`, kein `report-to`/`Reporting-Endpoints`:
    // GlitchTips Security-Endpunkt akzeptiert ausschließlich das Legacy-Format
    // (`{"csp-report":{…}}`), die neue Reporting-API sendet dagegen ein Array
    // als `application/reports+json` und wird abgelehnt. Zusätzlich ignoriert
    // Chromium `report-uri`, sobald `report-to` gesetzt ist — die Kombination
    // hätte in Chrome/Edge also GAR KEINE Reports mehr geliefert.
    const cspReportUrl = sentrySecurityReportUrl();

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(cspReportUrl ? [`report-uri ${cspReportUrl}`] : []),
    ].join("; ");

    return [
      // Alle HTML-Seiten und RSC-Daten: niemals cachen + Security-Header
      {
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      // Next.js statische Assets sind build-gehasht (Dateiname ändert sich bei jedem
      // Deploy) -> unbedenklich langfristig cachebar
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Service Worker: immer neu laden
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // GlitchTip-compatible: disable Sentry-specific build features we don't need
  silent: true,
  // Don't upload source maps to Sentry — GlitchTip doesn't support it via this plugin
  sourcemaps: { disable: true },
  // Ab SDK 10 gehören diese Optionen unter `webpack` (Top-Level ist deprecated).
  webpack: {
    // Ersetzt das deprecated `disableLogger` — entfernt die Debug-Logging-
    // Statements des SDK aus dem Bundle. Betrifft NICHT die Sentry-Logs
    // (enableLogs), die dieses Projekt für console.* nutzt.
    treeshake: { removeDebugLogging: true },
    // Route-Handler/Server-Funktionen instrumentieren wir nicht automatisch —
    // unbehandelte Exceptions deckt `onRequestError` in instrumentation.ts ab.
    autoInstrumentServerFunctions: false,
    autoInstrumentAppDirectory: false,
    // Middleware DAGEGEN schon: ohne Wrapping erreicht kein einziger
    // middleware.ts-Crash GlitchTip — auch nicht der harte throw bei fehlendem
    // SESSION_SECRET. Gewrappt werden nur Exceptions; abgelehnte/abgelaufene
    // Sessions bleiben wie dokumentiert stumm (AGENTS.md-Ausnahme).
    autoInstrumentMiddleware: true,
  },
});
