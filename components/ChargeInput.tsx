"use client";
import { useEffect, useId, useState } from "react";

interface ChargeMeta {
  chargeNr: string;
  letzterWareneingang: string;
  anzahlWareneingaenge: number;
  summeMenge: number;
  mhd: string | null;
  lieferant: string | null;
}

interface Props {
  artikelId: string | number | null | undefined;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  einheit?: string;
}

// Charge-Eingabe mit Dropdown der bereits im Wareneingang erfassten Chargen
// für den gewählten Artikel. Fällt auf reine Freitext-Eingabe zurück, wenn der
// Artikel keine Wareneingangs-Chargen hat.
function fmtMenge(n: number) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export default function ChargeInput({
  artikelId,
  value,
  onChange,
  placeholder = "Charge (optional)",
  className = "",
  einheit = "",
}: Props) {
  const reactId = useId();
  const datalistId = `chargen-${reactId.replace(/[:]/g, "")}`;
  const [chargen, setChargen] = useState<ChargeMeta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!artikelId) {
      setChargen([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/artikel/${artikelId}/chargen`)
      .then((r) => (r.ok ? r.json() : { chargen: [] }))
      .then((d) => {
        if (cancelled) return;
        setChargen(Array.isArray(d.chargen) ? d.chargen : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [artikelId]);

  const hasChargen = chargen.length > 0;
  const matched = hasChargen ? chargen.find((c) => c.chargeNr === value) : undefined;
  const unknown = !!value && hasChargen && !matched;

  return (
    <div className="relative">
      <input
        type="text"
        list={hasChargen ? datalistId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          loading
            ? "Lade Chargen…"
            : hasChargen
            ? `${chargen.length} bekannte Charge${chargen.length === 1 ? "" : "n"} — wählen oder neu eingeben`
            : placeholder
        }
        className={className}
      />
      {hasChargen && (
        <datalist id={datalistId}>
          {chargen.map((c) => {
            const datum = new Date(c.letzterWareneingang).toLocaleDateString("de-DE");
            const parts = [`${fmtMenge(c.summeMenge)}${einheit ? " " + einheit : ""}`, datum];
            if (c.lieferant) parts.push(c.lieferant);
            if (c.mhd) parts.push("MHD " + new Date(c.mhd).toLocaleDateString("de-DE"));
            return <option key={c.chargeNr} value={c.chargeNr} label={parts.join(" · ")} />;
          })}
        </datalist>
      )}
      {unknown && (
        <div className="text-[10px] text-amber-700 mt-0.5" title="Diese Charge ist nicht aus dem Wareneingang bekannt">
          ⚠ Neue Charge (kein Wareneingang)
        </div>
      )}
      {matched && (
        <div className="text-[10px] text-gray-500 mt-0.5">
          WE-Menge: {fmtMenge(matched.summeMenge)}{einheit ? " " + einheit : ""}
          {matched.mhd && <> · MHD {new Date(matched.mhd).toLocaleDateString("de-DE")}</>}
        </div>
      )}
    </div>
  );
}
