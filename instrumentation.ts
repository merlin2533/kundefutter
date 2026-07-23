export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("@/sentry.edge.config");
  }

  // Nur in der Node.js-Laufzeit, nicht im Edge-Runtime oder während des Builds
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { Sentry } = await import("@/lib/sentry");

  const { registerProcessErrorHandlers } = await import("@/lib/process-error-handlers");
  registerProcessErrorHandlers();

  try {
    const [{ ensureMusterDefaults }, { startBackupScheduler }] = await Promise.all([
      import("@/lib/muster-seed"),
      import("@/lib/backup"),
    ]);

    await ensureMusterDefaults();
    startBackupScheduler();
  } catch (err) {
    // Sentry sichtbar machen, bevor der Prozess ggf. durch einen kaputten
    // Serverstart abstürzt (z.B. DB nicht erreichbar).
    Sentry.captureException(err);
    throw err;
  }
}

export const onRequestError = async (
  err: { digest?: string } & Error,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string }
) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(err, request, context);
};
