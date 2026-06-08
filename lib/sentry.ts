import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

const isDev = process.env.NODE_ENV === "development";

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse | Response>;

/**
 * Wraps a Next.js App Router handler — catches unhandled exceptions,
 * reports them to GlitchTip, and returns a safe JSON error response.
 */
export function withSentry(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      Sentry.captureException(err, {
        extra: {
          url: req.url,
          method: req.method,
        },
      });
      const msg =
        isDev && err instanceof Error ? err.message : "Interner Serverfehler";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}

export { Sentry };
