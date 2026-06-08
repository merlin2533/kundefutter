import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

const isDev = process.env.NODE_ENV === "development";

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse | Response>;

/**
 * Wraps a Next.js App Router handler — catches unhandled exceptions,
 * enriches the Sentry event with request/user context, and returns a
 * safe JSON error response.
 */
export function withSentry(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx?: unknown) => {
    return Sentry.withScope(async (scope) => {
      scope.setTag("http.method", req.method);
      scope.setContext("request", {
        url: req.url,
        method: req.method,
        headers: Object.fromEntries(
          [...req.headers.entries()].filter(([k]) =>
            ["content-type", "user-agent", "x-forwarded-for", "x-real-ip"].includes(k)
          )
        ),
      });

      // Attach logged-in user to the Sentry event
      try {
        const token = req.cookies.get(SESSION_COOKIE)?.value;
        const session = await verifySession(token);
        if (session) {
          scope.setUser({
            id: String(session.sub),
            username: session.benutzername,
          });
          scope.setTag("user.rolle", session.rolle);
        }
      } catch {
        // non-fatal
      }

      try {
        return await handler(req, ctx);
      } catch (err) {
        const eventId = Sentry.captureException(err);
        const msg =
          isDev && err instanceof Error ? err.message : "Interner Serverfehler";
        return NextResponse.json({ error: msg, errorId: eventId }, { status: 500 });
      }
    });
  };
}

export { Sentry };
