import { createHmac } from "crypto";
import { NextResponse } from "next/server";

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

export async function GET() {
  const token = generateToken();
  return NextResponse.json(
    { token },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
