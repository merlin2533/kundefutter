/**
 * GiroCode / EPC-QR-Code Generator für SEPA-Überweisungen.
 *
 * Der auf deutschen Rechnungen übliche "ZUGFeRD QR" ist technisch gesehen ein
 * EPC-QR-Code (European Payments Council SCT-Code), umgangssprachlich "GiroCode".
 * Käufer scannen ihn mit ihrer Banking-App, um eine SEPA-Überweisung vorauszufüllen.
 *
 * Spezifikation: EPC069-12 v2.1 (BCD Version 002)
 *
 * Aufbau (je Zeile ein Feld, LF oder CRLF als Trennzeichen):
 *   1  Service Tag          "BCD"
 *   2  Version              "002"
 *   3  Character Set        "1" (UTF-8)
 *   4  Identification       "SCT"
 *   5  BIC                  optional ab v002
 *   6  Beneficiary Name     max. 70 Zeichen (Pflicht)
 *   7  IBAN                 max. 34 Zeichen (Pflicht)
 *   8  Amount               "EUR" + Betrag mit Punkt (max. 12 Stellen)
 *   9  Purpose              optional (4-stellig)
 *  10  Structured Reference max. 35 Zeichen (oder Feld 11, nie beide)
 *  11  Unstructured Remit.  max. 140 Zeichen (Verwendungszweck)
 *  12  Beneficiary Info     optional
 */

import QRCode from "qrcode";

export interface GiroCodeInput {
  empfaenger: string;
  iban: string;
  bic?: string;
  betrag: number;
  verwendungszweck: string;
}

/**
 * Bereinigt eine IBAN: entfernt Leerzeichen, macht Großbuchstaben.
 */
export function normalisiereIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

/**
 * Bereinigt eine BIC: entfernt Leerzeichen, macht Großbuchstaben.
 */
export function normalisiereBic(bic: string): string {
  return bic.replace(/\s+/g, "").toUpperCase();
}

/**
 * Erzeugt die EPC-QR-Payload (BCD-Format) für eine SEPA-Überweisung.
 * Liefert null, wenn Pflichtfelder fehlen oder ungültig sind.
 */
export function erzeugeGiroCodePayload(input: GiroCodeInput): string | null {
  const iban = normalisiereIban(input.iban);
  const empfaenger = input.empfaenger.trim().slice(0, 70);
  // EPC erlaubt Beträge mit max. 2 Nachkommastellen, Bereich 0.01–999999999.99
  if (!iban || !empfaenger) return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return null;
  if (!Number.isFinite(input.betrag) || input.betrag <= 0) return null;
  if (input.betrag > 999_999_999.99) return null;

  const bic = input.bic ? normalisiereBic(input.bic) : "";
  const betrag = `EUR${input.betrag.toFixed(2)}`;
  // Verwendungszweck auf 140 Zeichen begrenzen (Unstructured Remittance Information)
  const verwendung = input.verwendungszweck.trim().slice(0, 140);

  // Feld 10 (Structured Reference) leer lassen, Feld 11 nutzen
  const zeilen = [
    "BCD",
    "002",
    "1",
    "SCT",
    bic,
    empfaenger,
    iban,
    betrag,
    "", // Purpose
    "", // Structured Reference
    verwendung,
  ];

  // EPC-QR darf 331 Byte (UTF-8) nicht überschreiten
  const payload = zeilen.join("\n");
  if (Buffer.byteLength(payload, "utf8") > 331) return null;
  return payload;
}

/**
 * Erzeugt ein GiroCode-QR-Bild als PNG-DataURL.
 * Liefert null, wenn keine gültige Payload erzeugt werden kann.
 * Funktioniert sowohl serverseitig als auch im Browser.
 */
export async function erzeugeGiroCodeDataUrl(input: GiroCodeInput): Promise<string | null> {
  const payload = erzeugeGiroCodePayload(input);
  if (!payload) return null;
  try {
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}
