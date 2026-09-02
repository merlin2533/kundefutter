"use client";
import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  options: (string | Option)[];
  values: string[];
  onChange: (values: string[]) => void;
  allLabel?: string;
  className?: string;
}

function toOption(o: string | Option): Option {
  return typeof o === "string" ? { value: o, label: o } : o;
}

// Checkbox-Mehrfachauswahl im Dropdown, nach dem Vorbild von SearchableSelect.tsx (gleiches
// Öffnen/Schließen-, Trigger- und Panel-Muster, aber Checkboxen statt Einzelauswahl-Buttons).
// values.length === 0 bedeutet "alle" — der Aufrufer interpretiert eine leere Auswahl entsprechend.
export default function MultiSelectDropdown({ options, values, onChange, allLabel = "Alle", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const opts = options.map(toOption);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }

  const selectedLabels = opts.filter((o) => values.includes(o.value)).map((o) => o.label);
  const label =
    values.length === 0 ? allLabel : values.length === 1 ? selectedLabels[0] ?? values[0] : `${values.length} ausgewählt`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-green-600 bg-white ${
          open ? "border-green-600 ring-2 ring-green-600" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className={values.length === 0 ? "text-gray-400" : "text-gray-900"}>{label}</span>
        <svg className="w-4 h-4 text-gray-400 shrink-0 ml-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[220px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs">
            <button type="button" onClick={() => onChange([])} className="text-gray-500 hover:text-gray-700">
              {allLabel} (zurücksetzen)
            </button>
            <button
              type="button"
              onClick={() => onChange(opts.map((o) => o.value))}
              className="text-green-700 hover:text-green-900 font-medium"
            >
              Alle auswählen
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {opts.map((o) => (
              <label key={o.value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-green-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="w-4 h-4 rounded border-gray-300 text-green-700 focus:ring-green-600"
                />
                <span className="text-gray-800">
                  {o.label}
                  {o.hint && <span className="text-gray-400 ml-1 text-xs">{o.hint}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
