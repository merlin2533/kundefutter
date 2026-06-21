import { prisma } from "@/lib/prisma";

export interface AppearanceColors {
  primaryColor: string;
  primaryLight: string;
  accentColor: string;
}

export const DEFAULT_APPEARANCE_COLORS: AppearanceColors = {
  primaryColor: "#166534",
  primaryLight: "#f0fdf4",
  accentColor: "#f4a261",
};

export async function getAppearanceColors(): Promise<AppearanceColors> {
  const keys = ["system.primary_color", "system.primary_light", "system.accent_color"];
  const einstellungen = await prisma.einstellung.findMany({
    where: { key: { in: keys } },
  });
  const map: Record<string, string> = {};
  for (const e of einstellungen) map[e.key] = e.value;

  return {
    primaryColor: map["system.primary_color"] || DEFAULT_APPEARANCE_COLORS.primaryColor,
    primaryLight: map["system.primary_light"] || DEFAULT_APPEARANCE_COLORS.primaryLight,
    accentColor: map["system.accent_color"] || DEFAULT_APPEARANCE_COLORS.accentColor,
  };
}
