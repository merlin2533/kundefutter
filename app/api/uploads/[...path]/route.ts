import { NextRequest, NextResponse } from "next/server";
import { getUploadBase } from "@/lib/upload";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * GET /api/uploads/<relative-path>
 * Serves files from the uploads directory with path-traversal protection.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { path: segments } = await ctx.params;

  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "Pfad fehlt" }, { status: 400 });
  }

  // Path traversal protection: reject segments containing ".."
  if (segments.some((s) => s === ".." || s.includes("..") || s.includes("\0"))) {
    return NextResponse.json({ error: "Ungültiger Pfad" }, { status: 400 });
  }

  const base = getUploadBase();
  const relative = segments.join("/");
  const filePath = path.join(base, relative);

  // Ensure the resolved path is still inside the upload base
  const resolvedBase = path.resolve(base);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedBase + path.sep) && resolvedFile !== resolvedBase) {
    return NextResponse.json({ error: "Zugriff verweigert" }, { status: 403 });
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".pdf" ? "application/pdf" :
      ext === ".png" ? "image/png" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      ext === ".webp" ? "image/webp" :
      "application/octet-stream";

    const filename = path.basename(filePath);

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Datei nicht abrufbar" }, { status: 500 });
  }
}
