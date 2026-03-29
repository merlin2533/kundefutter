"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatDatum } from "@/lib/utils";

interface Position {
  id: number;
  menge: number;
  artikel: { name: string; einheit: string };
}

interface Kunde {
  name: string;
  firma?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  kontakte: { typ: string; wert: string }[];
}

interface Lieferung {
  id: number;
  datum: string;
  status: string;
  notiz?: string | null;
  lieferadresse?: string | null;
  positionen: Position[];
  kunde: Kunde;
}

export default function LieferscheinPage() {
  const { id } = useParams<{ id: string }>();
  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [firma, setFirma] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [lRes, eRes] = await Promise.all([
          fetch(`/api/lieferungen/${id}`),
          fetch("/api/einstellungen?prefix=firma."),
        ]);
        if (!lRes.ok) throw new Error("Lieferung nicht gefunden");
        const lData: Lieferung = await lRes.json();
        const eData: { key: string; value: string }[] = await eRes.json();
        const firmaMap: Record<string, string> = {};
        for (const e of eData) {
          firmaMap[e.key.replace("firma.", "")] = e.value;
        }
        setLieferung(lData);
        setFirma(firmaMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-gray-500">Lade Lieferschein…</div>
    );
  }

  if (error || !lieferung) {
    return (
      <div className="p-8 text-red-600">{error || "Lieferung nicht gefunden"}</div>
    );
  }

  const { kunde } = lieferung;
  const telefon = kunde.kontakte.find((k) => k.typ === "telefon" || k.typ === "mobil")?.wert;
  const email = kunde.kontakte.find((k) => k.typ === "email")?.wert;

  const firmaName = firma["name"] || firma["firmenname"] || "";
  const firmaStrasse = firma["strasse"] || "";
  const firmaPlz = firma["plz"] || "";
  const firmaOrt = firma["ort"] || "";
  const firmaTel = firma["tel"] || firma["telefon"] || "";
  const firmaEmail = firma["email"] || "";

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 2cm; size: A4; }
        }
      `}</style>

      {/* Control bar — hidden when printing */}
      <div className="print:hidden flex items-center gap-4 p-4 bg-gray-100 border-b no-print">
        <Link href={`/lieferungen/${lieferung.id}`} className="text-blue-600 hover:underline text-sm">
          ← Zurück
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Drucken
        </button>
      </div>

      {/* Lieferschein document */}
      <div className="max-w-[210mm] mx-auto p-8 bg-white text-black text-sm print:p-0 print:max-w-none">

        {/* Briefkopf */}
        <div className="flex justify-between items-start mb-8">
          {/* Absender links */}
          <div>
            {firmaName && <div className="font-bold text-base">{firmaName}</div>}
            {firmaStrasse && <div>{firmaStrasse}</div>}
            {(firmaPlz || firmaOrt) && (
              <div>{[firmaPlz, firmaOrt].filter(Boolean).join(" ")}</div>
            )}
            {firmaTel && <div>Tel.: {firmaTel}</div>}
            {firmaEmail && <div>{firmaEmail}</div>}
          </div>

          {/* Titel + Metadaten rechts */}
          <div className="text-right">
            <div className="text-2xl font-bold mb-2">Lieferschein</div>
            <div>
              <span className="text-gray-500">Nr.:</span>{" "}
              <span className="font-semibold">{lieferung.id}</span>
            </div>
            <div>
              <span className="text-gray-500">Datum:</span>{" "}
              <span>{formatDatum(lieferung.datum)}</span>
            </div>
          </div>
        </div>

        <hr className="border-gray-300 mb-6" />

        {/* Empfänger-Block */}
        <div className="mb-6">
          <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Empfänger</div>
          <div className="font-semibold">{kunde.name}</div>
          {kunde.firma && <div>{kunde.firma}</div>}
          {kunde.strasse && <div>{kunde.strasse}</div>}
          {(kunde.plz || kunde.ort) && (
            <div>{[kunde.plz, kunde.ort].filter(Boolean).join(" ")}</div>
          )}
          {telefon && <div>Tel.: {telefon}</div>}
          {email && <div>{email}</div>}
        </div>

        {/* Lieferadresse (falls abweichend) */}
        {lieferung.lieferadresse && (
          <div className="mb-6">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Lieferadresse</div>
            <div className="whitespace-pre-line">{lieferung.lieferadresse}</div>
          </div>
        )}

        {/* Positionen-Tabelle */}
        <table className="w-full border-collapse mb-8 text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 pr-4 w-10">Pos.</th>
              <th className="text-left py-2 pr-4">Artikel</th>
              <th className="text-right py-2 pr-4">Menge</th>
              <th className="text-left py-2">Einheit</th>
            </tr>
          </thead>
          <tbody>
            {lieferung.positionen.map((pos, idx) => (
              <tr key={pos.id} className="border-b border-gray-200">
                <td className="py-2 pr-4 text-gray-500">{idx + 1}</td>
                <td className="py-2 pr-4">{pos.artikel.name}</td>
                <td className="py-2 pr-4 text-right">
                  {pos.menge.toLocaleString("de-DE")}
                </td>
                <td className="py-2">{pos.artikel.einheit}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Bemerkung / Notiz */}
        {lieferung.notiz && (
          <div className="mb-8">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Bemerkung</div>
            <div className="whitespace-pre-line border border-gray-200 rounded p-3 print:border-gray-400">
              {lieferung.notiz}
            </div>
          </div>
        )}

        {/* Unterschriftszeile + QR-Code */}
        <div className="mt-12 flex justify-between items-end gap-8 text-sm">
          <div className="flex gap-16">
            <div>
              <div className="mb-8">Erhalten am: _______________</div>
              <div className="border-t border-black pt-1 w-48">Datum</div>
            </div>
            <div>
              <div className="mb-8">&nbsp;</div>
              <div className="border-t border-black pt-1 w-64">Unterschrift Empfänger</div>
            </div>
          </div>

          {/* QR-Code für Lieferbestätigung */}
          {origin && (
            <div className="flex flex-col items-center text-center text-xs text-gray-500">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${origin}/qr/${lieferung.id}`)}`}
                alt="QR-Code Lieferbestätigung"
                width={120}
                height={120}
                className="mb-1"
                unoptimized
              />
              <span>QR-Code scannen für<br />Lieferbestätigung</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-4 border-t border-gray-300 text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
          {firmaName && <span>{firmaName}</span>}
          {firmaStrasse && <span>{firmaStrasse}</span>}
          {(firmaPlz || firmaOrt) && (
            <span>{[firmaPlz, firmaOrt].filter(Boolean).join(" ")}</span>
          )}
          {firmaTel && <span>Tel.: {firmaTel}</span>}
          {firmaEmail && <span>{firmaEmail}</span>}
        </div>
      </div>
    </>
  );
}
