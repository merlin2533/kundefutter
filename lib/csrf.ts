import { createHmac } from "crypto";

function getSecret(): string {
  return process.env.SESSION_SECRET ?? process.env.RESEND_API_KEY ?? "dev-csrf-secret";
}

export function generateToken(): string {
  const ts = Date.now().toString();
  const sig = createHmac("sha256", getSecret()).update(ts).digest("hex");
  return `${ts}.${sig}`;
}

export function verifyToken(token: string): boolean {
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const age = Date.now() - Number(ts);
  if (isNaN(age) || age < 0 || age > 30 * 60 * 1000) return false;
  const expected = createHmac("sha256", getSecret()).update(ts).digest("hex");
  return sig === expected;
}
