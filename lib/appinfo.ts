import { prisma } from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";

/** Standard-Produktname, falls keine individuelle Bezeichnung hinterlegt ist. */
export const DEFAULT_APP_NAME = "AGRI-Office";

/**
 * Liefert den (white-label-fähigen) Anwendungsnamen für Navigation, Login und
 * PWA-Metadaten. Über die Einstellung `system.appname` individualisierbar.
 */
export async function getAppName(): Promise<string> {
  try {
    const e = await prisma.einstellung.findUnique({ where: { key: "system.appname" } });
    return e?.value?.trim() || DEFAULT_APP_NAME;
  } catch (err) {
    Sentry.captureException(err);
    return DEFAULT_APP_NAME;
  }
}
