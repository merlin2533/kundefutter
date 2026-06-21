import { prisma } from "@/lib/prisma";

export interface MargeConfig {
  warnungProzent: number;
  fehlerProzent: number;
}

const DEFAULT_MARGE_CONFIG: MargeConfig = {
  warnungProzent: 10,
  fehlerProzent: 0,
};

export async function getMargeConfig(): Promise<MargeConfig> {
  const rows = await prisma.einstellung.findMany({
    where: { key: { in: ["system.marge_warnung_prozent", "system.marge_fehler_prozent"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const warnung = parseFloat(map["system.marge_warnung_prozent"] ?? "");
  const fehler = parseFloat(map["system.marge_fehler_prozent"] ?? "");

  return {
    warnungProzent: Number.isFinite(warnung) ? warnung : DEFAULT_MARGE_CONFIG.warnungProzent,
    fehlerProzent: Number.isFinite(fehler) ? fehler : DEFAULT_MARGE_CONFIG.fehlerProzent,
  };
}
