import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function euro(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeIdStr = searchParams.get("kundeId");
  if (!kundeIdStr) return NextResponse.json({ error: "kundeId fehlt" }, { status: 400 });
  const kundeId = parseInt(kundeIdStr, 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });

  try {
    // Load settings (firma data + logo)
    const einstellungen = await prisma.einstellung.findMany({
      where: { key: { startsWith: "firma." } },
    });
    const settMap = Object.fromEntries(einstellungen.map((e) => [e.key, e.value]));
    const firmaName = settMap["firma.name"] ?? settMap["system.firmenname"] ?? "AGRI-Office";
    const firmaAdresse = [
      settMap["firma.strasse"],
      [settMap["firma.plz"], settMap["firma.ort"]].filter(Boolean).join(" "),
    ].filter(Boolean).join(", ");

    // Load logo
    const logoSetting = await prisma.einstellung.findFirst({ where: { key: "system.logo" } });
    const logoDataUrl = logoSetting?.value ?? "";

    // Load customer with special prices
    const kunde = await prisma.kunde.findUnique({
      where: { id: kundeId },
      select: {
        id: true,
        name: true,
        firma: true,
        artikelPreise: {
          select: {
            artikelId: true,
            preis: true,
          },
        },
      },
    });
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    const kundeName = kunde.firma ? `${kunde.firma} – ${kunde.name}` : kunde.name;

    // Special price map: artikelId → sonderpreis
    const sonderpreisMap = new Map<number, number>(
      kunde.artikelPreise.map((ap) => [ap.artikelId, ap.preis])
    );

    // Load all active articles
    const artikel = await prisma.artikel.findMany({
      where: { aktiv: true },
      select: {
        id: true,
        name: true,
        einheit: true,
        kategorie: true,
        unterkategorie: true,
        standardpreis: true,
      },
      orderBy: [{ kategorie: "asc" }, { name: "asc" }],
      take: 1000,
    });

    // Group by category
    const byKategorie = new Map<string, typeof artikel>();
    for (const art of artikel) {
      const kat = art.kategorie || "Sonstige";
      if (!byKategorie.has(kat)) byKategorie.set(kat, []);
      byKategorie.get(kat)!.push(art);
    }

    const stand = new Date().toLocaleDateString("de-DE");

    // Build HTML table rows per category
    const kategorieBlocks = Array.from(byKategorie.entries()).map(([kategorie, items]) => {
      const rows = items.map((art) => {
        const sonderpreis = sonderpreisMap.get(art.id);
        const hasSonderpreis = sonderpreis !== undefined;
        const standardpreisCell = hasSonderpreis
          ? `<span style="text-decoration:line-through;color:#9ca3af;">${euro(art.standardpreis)}</span>`
          : euro(art.standardpreis);
        const ihrPreisCell = hasSonderpreis
          ? `<span style="color:#166534;font-weight:600;">${euro(sonderpreis!)}</span>`
          : euro(art.standardpreis);
        return `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${art.name}${art.unterkategorie ? ` <span style="color:#6b7280;font-size:0.75em;">(${art.unterkategorie})</span>` : ""}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${art.einheit}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${standardpreisCell}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${ihrPreisCell}</td>
          </tr>`;
      }).join("");

      return `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:1rem;font-weight:700;color:#166534;border-bottom:2px solid #16a34a;padding-bottom:4px;margin-bottom:8px;">${kategorie}</h3>
          <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px 10px;text-align:left;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;border-bottom:2px solid #e5e7eb;">Artikel</th>
                <th style="padding:8px 10px;text-align:center;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;border-bottom:2px solid #e5e7eb;">Einheit</th>
                <th style="padding:8px 10px;text-align:right;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;border-bottom:2px solid #e5e7eb;">Standardpreis</th>
                <th style="padding:8px 10px;text-align:right;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#166534;border-bottom:2px solid #e5e7eb;">Ihr Preis</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }).join("");

    const logoHtml = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;" />`
      : "";

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preisliste – ${kundeName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #111827; background: #fff; padding: 24px; }
    @media print {
      @page { margin: 1.5cm; size: A4; }
      body { padding: 0; }
      .no-print { display: none !important; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #166534; padding-bottom: 16px; }
    .firma-info h1 { font-size: 1.25rem; font-weight: 700; color: #166534; }
    .firma-info p { font-size: 0.875rem; color: #6b7280; margin-top: 2px; }
    .meta { text-align: right; }
    .meta h2 { font-size: 1.1rem; font-weight: 700; color: #111827; }
    .meta p { font-size: 0.875rem; color: #6b7280; margin-top: 2px; }
    .print-btn { margin-bottom: 20px; }
    .print-btn button { padding: 8px 16px; background: #166534; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .print-btn button:hover { background: #14532d; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; text-align: center; }
    .sonderpreis-hint { margin-bottom: 16px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 0.8rem; color: #166534; }
  </style>
</head>
<body>
  <div class="no-print print-btn">
    <button onclick="window.print()">Drucken / Als PDF speichern</button>
  </div>
  <div class="header">
    <div class="firma-info">
      ${logoHtml}
      <h1>${firmaName}</h1>
      ${firmaAdresse ? `<p>${firmaAdresse}</p>` : ""}
    </div>
    <div class="meta">
      <h2>Preisliste</h2>
      <p><strong>${kundeName}</strong></p>
      <p>Stand: ${stand}</p>
    </div>
  </div>
  ${sonderpreisMap.size > 0 ? `<div class="sonderpreis-hint">Artikel mit individuellen Preisen sind in der Spalte "Ihr Preis" grün hervorgehoben.</div>` : ""}
  ${kategorieBlocks}
  <div class="footer">
    Alle Preise in Euro, netto zzgl. gesetzlicher MwSt. &bull; Stand: ${stand} &bull; ${firmaName}
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
