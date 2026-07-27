/**
 * Server-seitiger Sentry-Zugang.
 *
 * Hier lag früher zusätzlich ein `withSentry()`-Route-Wrapper, der Request- und
 * User-Kontext angereichert und eine `errorId` im 500er zurückgegeben hat. Er
 * wurde von 0 der 276 API-Routen benutzt — toter Code, der eine Anreicherung
 * suggerierte, die nie lief. Ersatz:
 *   - unbehandelte Route-Exceptions → `onRequestError` in `instrumentation.ts`
 *   - User-Kontext → `verifySession()` in `lib/auth.ts` (ein Trichter für alle
 *     authentifizierten Routen)
 *   - Referenzcode für den Nutzer → `error.digest`/eventId in `app/error.tsx`
 *
 * Für Log-/Fehlerausgaben ist `lib/logger.ts` der Einstieg (`log.error(...)`),
 * nicht `captureException` direkt.
 */
export * as Sentry from "@sentry/nextjs";
