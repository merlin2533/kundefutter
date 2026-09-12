import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { DEFAULT_MODUL_CONFIG, modulConfigAusMap, type ModulConfig, type ModulKey } from "@/lib/modul-keys";

// Typ/Defaults leben in lib/modul-keys.ts (importfrei, client-sicher) und werden hier
// re-exportiert, damit die bestehenden `import { ModulConfig } from "@/lib/modul-config"`
// in den API-Routen unverändert weiterfunktionieren.
export { DEFAULT_MODUL_CONFIG, modulConfigAusMap };
export type { ModulConfig, ModulKey };

export async function getModulConfig(): Promise<ModulConfig> {
  const einstellungen = await prisma.einstellung.findMany({
    where: { key: { startsWith: "modul." } },
  });
  const map: Record<string, string> = {};
  for (const e of einstellungen) map[e.key] = e.value;
  return modulConfigAusMap(map);
}

/** Serverseitiger Guard analog requirePermission() (lib/permissions.ts) — sperrt eine API-Route,
 *  wenn das zugehörige Modul deaktiviert ist. Orthogonal zum Berechtigungssystem: eine Route kann
 *  beides prüfen (erst requirePermission, dann requireModul), beide müssen unabhängig grün sein. */
export function requireModul(config: ModulConfig, key: ModulKey): NextResponse | null {
  if (!config[key]) {
    return NextResponse.json({ error: "Modul deaktiviert" }, { status: 403 });
  }
  return null;
}
