import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { Resend } from "resend";

export type EmailProvider = "smtp" | "resend";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type EmailConfig = {
  provider: EmailProvider;
  fromAddress: string;
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
      ? map["resend.from"] ?? ""
      : map["smtp.from"] ?? map["smtp.user"] ?? "";

  return {
    provider,
    fromAddress,
    smtpHost: map["smtp.host"],
    smtpPort: map["smtp.port"] ? Number(map["smtp.port"]) : 587,
    smtpSecure: map["smtp.secure"] === "true",
    smtpUser: map["smtp.user"],
    smtpPass: map["smtp.password"],
    resendApiKey: map["resend.api_key"],
  };
}

export type SendEmailArgs = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
  fromName?: string;
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

  if (cfg.provider === "resend") {
    if (!cfg.resendApiKey) throw new Error("Resend API-Key fehlt");
    const client = new Resend(cfg.resendApiKey);
    const res = await client.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      attachments: args.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      })),
    });
    if (res.error) throw new Error(res.error.message ?? "Resend-Versand fehlgeschlagen");
    return;
  }

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
    subject: args.subject,
    text: args.text,
    html: args.html,
    attachments: args.attachments,
  });
}

export async function verifyEmailConfig(): Promise<void> {
  const cfg = await loadEmailConfig();
  if (cfg.provider === "resend") {
    if (!cfg.resendApiKey) throw new Error("Resend API-Key fehlt");
    const client = new Resend(cfg.resendApiKey);
    const res = await client.domains.list();
    if (res.error) throw new Error(res.error.message ?? "Resend-API-Key ungültig");
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
