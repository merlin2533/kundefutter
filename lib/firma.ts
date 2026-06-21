import { prisma } from "@/lib/prisma";

export interface FirmaDaten {
  name: string;
  zusatz: string;
  strasse: string;
  plzOrt: string;
  telefon: string;
  email: string;
  steuernummer: string;
  ustIdNr?: string;
  oekoNummer?: string;
  iban: string;
  bic: string;
  bank: string;
  // E-Mail-Footer / Rechtliches
  emailFooterText: string;
  portalImpressumUrl: string;
  datenschutzUrl: string;
  // Branding-Farben für E-Mail-Templates
  primaryColor: string;
  primaryLight: string;
}

const FIRMA_DEFAULTS: FirmaDaten = {
  name: "",
  zusatz: "",
  strasse: "",
  plzOrt: "",
  telefon: "",
  email: "",
  steuernummer: "",
  oekoNummer: "",
  iban: "",
  bic: "",
  bank: "",
  emailFooterText: "",
  portalImpressumUrl: "",
  datenschutzUrl: "",
  primaryColor: "#166534",
  primaryLight: "#f0fdf4",
};

export async function ladeFirmaDaten(): Promise<FirmaDaten> {
  const einstellungen = await prisma.einstellung.findMany({
    where: {
      OR: [
        { key: { startsWith: "firma." } },
        { key: "system.primary_color" },
        { key: "system.primary_light" },
      ],
    },
  });
  const map: Record<string, string> = {};
  for (const e of einstellungen) {
    const k = e.key.startsWith("firma.") ? e.key.replace("firma.", "") : e.key;
    map[k] = e.value;
  }
  const plzOrt = map.plzOrt
    ?? [map.plz, map.ort].filter(Boolean).join(" ")
    ?? FIRMA_DEFAULTS.plzOrt;
  return {
    name: map.name ?? FIRMA_DEFAULTS.name,
    zusatz: map.zusatz ?? FIRMA_DEFAULTS.zusatz,
    strasse: map.strasse ?? FIRMA_DEFAULTS.strasse,
    plzOrt,
    telefon: map.telefon ?? FIRMA_DEFAULTS.telefon,
    email: map.email ?? FIRMA_DEFAULTS.email,
    steuernummer: map.steuernummer ?? FIRMA_DEFAULTS.steuernummer,
    ustIdNr: map.ustIdNr ?? "",
    oekoNummer: map.oekoNummer ?? "",
    iban: map.iban ?? FIRMA_DEFAULTS.iban,
    bic: map.bic ?? FIRMA_DEFAULTS.bic,
    bank: map.bank ?? FIRMA_DEFAULTS.bank,
    emailFooterText: map.email_footer_text ?? FIRMA_DEFAULTS.emailFooterText,
    portalImpressumUrl: map.portal_impressum_url ?? FIRMA_DEFAULTS.portalImpressumUrl,
    datenschutzUrl: map.datenschutz_url ?? FIRMA_DEFAULTS.datenschutzUrl,
    primaryColor: map["system.primary_color"] || FIRMA_DEFAULTS.primaryColor,
    primaryLight: map["system.primary_light"] || FIRMA_DEFAULTS.primaryLight,
  };
}
