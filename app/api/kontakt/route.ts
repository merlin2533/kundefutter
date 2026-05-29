import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyToken, generateToken } from "./csrf/route";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Simple in-memory rate limiter: max 3 submissions per IP per hour
const rateLimitMap = new Map<string, { count: number; first: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.first > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, first: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function clean(s: string, max = 200): string {
  return s.replace(/<[^>]*>/g, "").trim().slice(0, max);
}

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ ok: false, error: "E-Mail-Dienst nicht konfiguriert." }, 503);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: "Ungültige Anfrage." }, 400);
  }

  // Honeypot check
  if (form.get("website")) return json({ ok: true });

  // CSRF check
  const csrf = (form.get("csrf") as string | null) ?? "";
  if (!verifyToken(csrf)) {
    return json({ ok: false, error: "Ungültige Sitzung. Seite neu laden und erneut versuchen." }, 403);
  }

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return json({ ok: false, error: "Zu viele Anfragen. Bitte warten Sie eine Stunde." }, 429);
  }

  // Input validation
  const name = clean((form.get("name") as string | null) ?? "");
  const firma = clean((form.get("firma") as string | null) ?? "");
  const email = clean((form.get("email") as string | null) ?? "", 254);
  const telefon = clean((form.get("telefon") as string | null) ?? "", 30);
  const paket = clean((form.get("paket") as string | null) ?? "");
  const nachricht = clean((form.get("nachricht") as string | null) ?? "", 2000);
  const dsgvo = form.get("dsgvo") === "on";

  const errors: string[] = [];
  if (name.length < 2) errors.push("Bitte geben Sie Ihren Namen ein.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Bitte eine gültige E-Mail-Adresse eingeben.");
  if (nachricht.length < 10) errors.push("Bitte schreiben Sie eine kurze Nachricht (min. 10 Zeichen).");
  if (!dsgvo) errors.push("Bitte stimmen Sie der Datenschutzerklärung zu.");

  if (errors.length) return json({ ok: false, error: errors.join(" ") }, 422);

  const paketLabel = paket || "(nicht angegeben)";
  const telefonLabel = telefon || "(nicht angegeben)";
  const ts = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

  const notificationHtml = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#1f2937;background:#f9fafb;margin:0}
.wrap{max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.header{background:#1b4332;padding:28px 32px;color:white}
.header h1{margin:0;font-size:1.3rem;font-weight:700}
.header p{margin:6px 0 0;font-size:.875rem;opacity:.75}
.body{padding:32px}
.field{margin-bottom:20px}
.field-label{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:4px}
.field-value{font-size:1rem;color:#111827;background:#f3f4f6;padding:10px 14px;border-radius:8px;border-left:3px solid #40916c}
.msg{white-space:pre-line}
.footer{background:#f3f4f6;padding:20px 32px;font-size:.8rem;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head>
<body><div class="wrap">
<div class="header">
  <h1>Neue Anfrage über AGRI-Office.de</h1>
  <p>Eingegangen: ${ts} · IP: ${ip}</p>
</div>
<div class="body">
  <div class="field"><div class="field-label">Name</div><div class="field-value">${name}</div></div>
  <div class="field"><div class="field-label">Firma / Betrieb</div><div class="field-value">${firma}</div></div>
  <div class="field"><div class="field-label">E-Mail</div><div class="field-value"><a href="mailto:${email}">${email}</a></div></div>
  <div class="field"><div class="field-label">Telefon</div><div class="field-value">${telefonLabel}</div></div>
  <div class="field"><div class="field-label">Gewünschter Plan</div><div class="field-value">${paketLabel}</div></div>
  <div class="field"><div class="field-label">Nachricht</div><div class="field-value msg">${nachricht}</div></div>
</div>
<div class="footer">Diese E-Mail wurde automatisch von der AGRI-Office-Website gesendet. DSGVO-Einwilligung: erteilt.</div>
</div></body></html>`;

  const confirmHtml = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#1f2937;background:#f9fafb;margin:0}
.wrap{max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.header{background:#1b4332;padding:32px;color:white;text-align:center}
.header h1{margin:0;font-size:1.4rem}
.header p{margin:8px 0 0;opacity:.8}
.body{padding:32px;text-align:center}
.body p{color:#4b5563;line-height:1.7;margin-bottom:16px}
.highlight{background:#d8f3dc;border-radius:8px;padding:16px;margin:24px 0;font-weight:600;color:#1b4332}
.footer{padding:20px 32px;text-align:center;font-size:.8rem;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head>
<body><div class="wrap">
<div class="header">
  <h1>Danke, ${name}!</h1>
  <p>Ihre Anfrage ist bei uns angekommen.</p>
</div>
<div class="body">
  <p>Wir haben Ihre Anfrage erhalten und melden uns innerhalb von <strong>1 Werktag</strong> bei Ihnen zurück.</p>
  <div class="highlight">📞 Telefon: +49 (0) 000 000000<br>✉ E-Mail: info@agri-office.de</div>
  <p>Bis dahin können Sie unsere <a href="https://agri-office.de/#funktionen" style="color:#40916c">Funktionsübersicht</a> erkunden oder direkt mit dem <strong>14-tägigen kostenlosen Test</strong> starten.</p>
</div>
<div class="footer">AGRI-Office · info@agri-office.de · agri-office.de</div>
</div></body></html>`;

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "AGRI-Office Website <noreply@agri-office.de>",
    to: ["info@agri-office.de"],
    replyTo: email,
    subject: `Neue AGRI-Office-Anfrage von ${name} (${firma})`,
    html: notificationHtml,
    tags: [
      { name: "source", value: "website-contact" },
      { name: "paket", value: paket.replace(/[^a-z0-9_-]/gi, "") || "unknown" },
    ],
  });

  if (error) {
    console.error("Resend notification error:", error);
    return json({ ok: false, error: "E-Mail konnte nicht gesendet werden. Bitte rufen Sie uns direkt an." }, 502);
  }

  // Confirmation to the visitor — fire-and-forget
  resend.emails.send({
    from: "AGRI-Office Website <noreply@agri-office.de>",
    to: [email],
    subject: "Ihre AGRI-Office-Anfrage ist eingegangen",
    html: confirmHtml,
  }).catch((err) => console.error("Resend confirmation error:", err));

  return json({
    ok: true,
    message: "Danke! Ihre Nachricht wurde gesendet. Wir melden uns innerhalb von 1 Werktag.",
    csrf: generateToken(),
  });
}
