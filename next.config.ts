import type { NextConfig } from "next";
import { randomUUID } from "crypto";
import { version as appVersion } from "./package.json";
import { withSentryConfig } from "@sentry/nextjs";

const buildId = randomUUID();

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
  disableLogger: true,
  // Don't upload source maps to Sentry — GlitchTip doesn't support it via this plugin
  sourcemaps: { disable: true },
  // Disable automatic instrumentation wrapping (we do it manually via instrumentation.ts)
  autoInstrumentServerFunctions: false,
  autoInstrumentMiddleware: false,
  autoInstrumentAppDirectory: false,
});
