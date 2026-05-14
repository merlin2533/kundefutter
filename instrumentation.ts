/**
 * Next.js Instrumentation – läuft einmalig beim Start einer Serverinstanz.
 * Wird genutzt für: Muster-Vorgaben bei Neuinstallation + Backup-Scheduler.
 */
export async function register() {
  // Nur in der Node.js-Laufzeit, nicht im Edge-Runtime oder während des Builds
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const [{ ensureMusterDefaults }, { startBackupScheduler }] = await Promise.all([
    import("@/lib/muster-seed"),
    import("@/lib/backup"),
  ]);

  await ensureMusterDefaults();
  startBackupScheduler();
}
