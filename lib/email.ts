import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { Resend } from "resend";

// Rate limiter: max 5 E-Mails/Sekunde = min. 200ms Abstand
const MIN_INTERVAL_MS = 200;
let _lastEmailTime = 0;
async function enforceRateLimit() {
  const wait = MIN_INTERVAL_MS - (Date.now() - _lastEmailTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  _lastEmailTime = Date.now();
}

export type EmailProvider = "smtp" | "resend";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type EmailConfig = {
  provider: EmailProvider;
  fromAddress: string;
  replyTo?: string;
  bcc?: string;
  cc?: string;
  smtpHost?: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPass?: string;
  resendApiKey?: string;
};

export async function loadEmailConfig(): Promise<EmailConfig> {
  const rows = await prisma.einstellung.findMany({
    where: {
      OR: [
        { key: { startsWith: "smtp." } },
        { key: { startsWith: "email." } },
        { key: { startsWith: "resend." } },
      ],
    },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  const provider: EmailProvider = map["email.provider"] === "resend" ? "resend" : "smtp";
  const fromAddress =
    provider === "resend"
      ? map["resend.from"] ?? map["email.from"] ?? ""
      : map["smtp.from"] ?? map["smtp.user"] ?? map["email.from"] ?? "";

  return {
    provider,
    fromAddress,
    replyTo: map["email.reply_to"] || undefined,
    bcc: map["email.bcc"] || undefined,
    cc: map["email.cc"] || undefined,
    smtpHost: map["smtp.host"],
    smtpPort: (() => { const p = parseInt(map["smtp.port"] ?? "", 10); return isNaN(p) ? 587 : p; })(),
    smtpSecure: map["smtp.secure"] === "true",
    smtpUser: map["smtp.user"],
    smtpPass: map["smtp.password"],
    resendApiKey: map["resend.api_key"],
  };
}

export type SendEmailArgs = {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
  fromName?: string;
  feature?: string;
};

function buildFromHeader(cfg: EmailConfig, fromName?: string): string {
  if (fromName && cfg.fromAddress) return `"${fromName.replace(/"/g, "'")}" <${cfg.fromAddress}>`;
  return cfg.fromAddress;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const cfg = await loadEmailConfig();
  if (!cfg.fromAddress) {
    throw new Error("Absender-Adresse nicht konfiguriert (Einstellungen → E-Mail)");
  }
  const from = buildFromHeader(cfg, args.fromName);
  const anhangNamen = JSON.stringify(args.attachments?.map((a) => a.filename) ?? []);

  await enforceRateLimit();

  try {
    // CC: args.cc takes priority, falls back to global email.cc setting
    const effectiveCc = args.cc || cfg.cc || undefined;

    if (cfg.provider === "resend") {
      if (!cfg.resendApiKey) throw new Error("Resend API-Key fehlt");
      const client = new Resend(cfg.resendApiKey);
      const res = await client.emails.send({
        from,
        to: args.to,
        cc: effectiveCc ? [effectiveCc] : undefined,
        subject: args.subject,
        text: args.text,
        html: args.html,
        replyTo: cfg.replyTo,
        bcc: cfg.bcc ? [cfg.bcc] : undefined,
        attachments: args.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString("base64"),
        })),
      });
      if (res.error) throw new Error(res.error.message ?? "Resend-Versand fehlgeschlagen");
    } else {
      if (!cfg.smtpHost) throw new Error("SMTP-Host nicht konfiguriert");
      const transporter = nodemailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpSecure,
        auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass ?? "" } : undefined,
      });
      await transporter.sendMail({
        from,
        to: args.to,
        cc: effectiveCc,
        replyTo: cfg.replyTo,
        bcc: cfg.bcc,
        subject: args.subject,
        text: args.text,
        html: args.html,
        attachments: args.attachments,
      });
    }

    // Log erfolgreichen Versand
    await prisma.mailLog.create({
      data: {
        empfaenger: args.to,
        betreff: args.subject,
        textBody: args.text,
        htmlBody: args.html,
        status: "gesendet",
        feature: args.feature ?? null,
        anhangNamen,
      },
    }).catch(() => {}); // Log-Fehler nie nach oben werfen
  } catch (err) {
    // Log fehlgeschlagenen Versand
    await prisma.mailLog.create({
      data: {
        empfaenger: args.to,
        betreff: args.subject,
        textBody: args.text,
        htmlBody: args.html,
        status: "fehler",
        fehler: err instanceof Error ? err.message : String(err),
        feature: args.feature ?? null,
        anhangNamen,
      },
    }).catch(() => {});
    throw err;
  }
}

export async function verifyEmailConfig(): Promise<void> {
  const cfg = await loadEmailConfig();
  if (cfg.provider === "resend") {
    if (!cfg.resendApiKey) throw new Error("Resend API-Key fehlt");
    if (!cfg.fromAddress) throw new Error("Absender-Adresse nicht konfiguriert (Einstellungen → E-Mail → Absender-Adresse)");

    const client = new Resend(cfg.resendApiKey);
    const res = await client.domains.list();
    if (res.error) {
      // A 403/forbidden error means the key exists but only has sending_access (not full_access).
      // That is still a valid key — treat it as OK.
      const name = (res.error as { name?: string }).name ?? "";
      const msg = res.error.message ?? "";
      if (/forbidden|not_authorized|403/i.test(name) || /forbidden|not_authorized|403/i.test(msg)) {
        return;
      }
      throw new Error(msg || "Resend-API-Key ungültig");
    }
    return;
  }
  if (!cfg.smtpHost) throw new Error("SMTP-Host nicht konfiguriert");
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass ?? "" } : undefined,
  });
  await transporter.verify();
}
