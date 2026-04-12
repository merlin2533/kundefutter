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
}

const FIRMA_DEFAULTS: FirmaDaten = {
  name: "Landhandel Röthemeier",
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
};

export async function ladeFirmaDaten(): Promise<FirmaDaten> {
  const einstellungen = await prisma.einstellung.findMany({
    where: { key: { startsWith: "firma." } },
  });
  const map: Record<string, string> = {};
  for (const e of einstellungen) {
    map[e.key.replace("firma.", "")] = e.value;
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
  };
}
