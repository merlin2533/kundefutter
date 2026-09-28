// Konfiguration des automatischen E-Mail-Rechnungseingangs (IMAP-Postfach oder Microsoft 365),
// abgelegt als einfache Einstellung-Key/Value-Paare unter dem Präfix "email.eingang." — analog zur
// bestehenden SMTP-/Resend-Konfiguration (smtp.*/resend.*), inkl. derselben Konvention "Secrets
// liegen als Klartext im Einstellung-Store, das Frontend lädt sie nie zurück ins Formular".
//
// Server-only (importiert prisma) — die Settings-Seite liest/schreibt ausschließlich über den
// bereits vorhandenen generischen GET/PUT /api/einstellungen?prefix=email.eingang.-Weg, genau wie
// /einstellungen/email das für smtp.*/resend.* bereits tut.

import { prisma } from "@/lib/prisma";

export type EmailEingangProvider = "imap" | "m365";

export interface EmailEingangConfig {
  aktiv: boolean;
  provider: EmailEingangProvider;
  /** Nur Mails, die AB diesem Zeitpunkt eingegangen sind, werden verarbeitet — verhindert, dass
   * das erstmalige Aktivieren an einem bestehenden Postfach dessen komplette Historie (ggf.
   * tausende Mails) auf einen Schlag über Mistral schickt. Wird beim Einschalten automatisch auf
   * "jetzt" gesetzt (app/einstellungen/email-rechnungseingang/page.tsx, saveAll()), nicht vom
   * Nutzer frei wählbar. Bekannte Lücke: wird beim Wechsel von Konto/Ordner/Provider NICHT
   * automatisch zurückgesetzt — ein Kontowechsel kann dadurch wieder weit in die Vergangenheit
   * zurücksuchen (Folgeauftrag). */
  aktivSeit: Date | null;
  imap: {
    host: string;
    port: number;
    /** Immer true erzwungen (siehe ladeEmailEingangConfig) — unverschlüsseltes IMAP wird bewusst
     * nicht angeboten. */
    secure: boolean;
    user: string;
    passwort: string;
    ordner: string;
    uidvalidity: string;
    letzteUid: number;
  };
  m365: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    mailbox: string;
    letzterAbruf: Date | null;
  };
}

const KEYS = [
  "email.eingang.aktiv",
  "email.eingang.provider",
  "email.eingang.aktivSeit",
  "email.eingang.imap.host",
  "email.eingang.imap.port",
  "email.eingang.imap.user",
  "email.eingang.imap.passwort",
  "email.eingang.imap.ordner",
  "email.eingang.imap.uidvalidity",
  "email.eingang.imap.letzteUid",
  "email.eingang.m365.tenantId",
  "email.eingang.m365.clientId",
  "email.eingang.m365.clientSecret",
  "email.eingang.m365.mailbox",
  "email.eingang.m365.letzterAbruf",
];

export async function ladeEmailEingangConfig(): Promise<EmailEingangConfig> {
  const rows = await prisma.einstellung.findMany({ where: { key: { in: KEYS } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? "";

  const aktivSeitRaw = get("email.eingang.aktivSeit");
  const letzterAbrufRaw = get("email.eingang.m365.letzterAbruf");

  return {
    aktiv: get("email.eingang.aktiv") === "true",
    provider: get("email.eingang.provider") === "m365" ? "m365" : "imap",
    aktivSeit: aktivSeitRaw ? new Date(aktivSeitRaw) : null,
    imap: {
      host: get("email.eingang.imap.host"),
      port: Number(get("email.eingang.imap.port")) || 993,
      secure: true,
      user: get("email.eingang.imap.user"),
      passwort: get("email.eingang.imap.passwort"),
      ordner: get("email.eingang.imap.ordner") || "INBOX",
      uidvalidity: get("email.eingang.imap.uidvalidity"),
      letzteUid: Number(get("email.eingang.imap.letzteUid")) || 0,
    },
    m365: {
      tenantId: get("email.eingang.m365.tenantId"),
      clientId: get("email.eingang.m365.clientId"),
      clientSecret: get("email.eingang.m365.clientSecret"),
      mailbox: get("email.eingang.m365.mailbox"),
      letzterAbruf: letzterAbrufRaw ? new Date(letzterAbrufRaw) : null,
    },
  };
}

export function istEmailEingangVollstaendigKonfiguriert(cfg: EmailEingangConfig): boolean {
  if (cfg.provider === "imap") {
    return !!(cfg.imap.host && cfg.imap.port && cfg.imap.user && cfg.imap.passwort);
  }
  return !!(cfg.m365.tenantId && cfg.m365.clientId && cfg.m365.clientSecret && cfg.m365.mailbox);
}

async function setzeWert(key: string, value: string) {
  await prisma.einstellung.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Persistiert den Fortschritt nach einem Abruf-Lauf — IMAP-UID-Cursor bzw. Graph-Zeitstempel,
 * je nach Provider. Wird nur bis zu der Mail vorgerückt, die tatsächlich final verarbeitet wurde
 * (siehe lib/email-eingang-verarbeitung.ts) — eine Mail mit Status "fehler" und noch nicht
 * ausgeschöpften Wiederholversuchen lässt den Cursor bewusst dort stehen, damit der nächste Lauf
 * sie erneut aus dem Postfach lädt statt sie endgültig zu verlieren.
 *
 * `uidvalidity` und `letzteUid` werden in EINER Transaktion geschrieben — ein Abbruch zwischen
 * den beiden Upserts (z.B. Prozess-Neustart) dürfte sonst "neue UIDVALIDITY, aber noch alte UID"
 * stehen lassen, wodurch der nächste Lauf denselben UID-Bereich fälschlich als "schon verarbeitet"
 * überspringt (siehe die Absicherung in lib/email-eingang-abruf.ts, die bei UIDVALIDITY-Wechsel
 * ohnehin bei UID 0 startet — dieselbe Garantie gilt dann auch für den persistierten Wert). */
export async function speichereImapCursor(uidvalidity: string, letzteUid: number) {
  await prisma.$transaction([
    prisma.einstellung.upsert({
      where: { key: "email.eingang.imap.uidvalidity" },
      update: { value: uidvalidity },
      create: { key: "email.eingang.imap.uidvalidity", value: uidvalidity },
    }),
    prisma.einstellung.upsert({
      where: { key: "email.eingang.imap.letzteUid" },
      update: { value: String(letzteUid) },
      create: { key: "email.eingang.imap.letzteUid", value: String(letzteUid) },
    }),
  ]);
}

export async function speichereM365Cursor(letzterAbruf: Date) {
  await setzeWert("email.eingang.m365.letzterAbruf", letzterAbruf.toISOString());
}
