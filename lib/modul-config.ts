import { prisma } from "@/lib/prisma";

export interface ModulConfig {
  sortenversuche: boolean;
  rationsberechnung: boolean;
  bodenproben: boolean;
  psm_ausbringung: boolean;
  erzeugerabrechnung: boolean;
  tourenplanung: boolean;
  kontrakte: boolean;
  kampagnen: boolean;
  fruehbezug: boolean;
  mqtt: boolean;
  nextcloud: boolean;
  marktpreise: boolean;
  reklamationen: boolean;
  personal: boolean;
}

export const DEFAULT_MODUL_CONFIG: ModulConfig = {
  sortenversuche: true,
  rationsberechnung: true,
  bodenproben: true,
  psm_ausbringung: true,
  erzeugerabrechnung: true,
  tourenplanung: true,
  kontrakte: true,
  kampagnen: true,
  fruehbezug: true,
  mqtt: false,
  nextcloud: false,
  marktpreise: true,
  reklamationen: true,
  personal: true,
};

export async function getModulConfig(): Promise<ModulConfig> {
  const einstellungen = await prisma.einstellung.findMany({
    where: { key: { startsWith: "modul." } },
  });
  const map: Record<string, string> = {};
  for (const e of einstellungen) {
    map[e.key.replace("modul.", "")] = e.value;
  }
  function bool(key: keyof ModulConfig): boolean {
    if (!(key in map)) return DEFAULT_MODUL_CONFIG[key];
    return map[key] !== "false" && map[key] !== "0";
  }
  return {
    sortenversuche: bool("sortenversuche"),
    rationsberechnung: bool("rationsberechnung"),
    bodenproben: bool("bodenproben"),
    psm_ausbringung: bool("psm_ausbringung"),
    erzeugerabrechnung: bool("erzeugerabrechnung"),
    tourenplanung: bool("tourenplanung"),
    kontrakte: bool("kontrakte"),
    kampagnen: bool("kampagnen"),
    fruehbezug: bool("fruehbezug"),
    mqtt: bool("mqtt"),
    nextcloud: bool("nextcloud"),
    marktpreise: bool("marktpreise"),
    reklamationen: bool("reklamationen"),
    personal: bool("personal"),
  };
}
