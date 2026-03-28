"use client";
import { useState, useRef, useEffect } from "react";

interface Option {
  value: string | number;
  label: string;
  sub?: string;
}

interface Props {
  options: Option[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  allowClear?: boolean;
  clearLabel?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "— Bitte wählen —",
  required,
  className = "",
  allowClear = false,
  clearLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = options.filter((o) => {
    const q = search.toLowerCase();
    return o.label.toLowerCase().includes(q) || (o.sub?.toLowerCase().includes(q) ?? false);
  });

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function handleOpen() {
    setOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-green-600 ${
          open ? "border-green-600 ring-2 ring-green-600" : "border-gray-300 hover:border-gray-400"
        } bg-white`}
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ? (
            <span>
              {selected.label}
              {selected.sub && <span className="text-gray-400 ml-1 text-xs">{selected.sub}</span>}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0 ml-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Hidden required input for form validation */}
      {required && (
        <input
          type="text"
          required
          value={String(value)}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden
          className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
        />
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {allowClear && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100 transition-colors"
              >
                {clearLabel ?? placeholder}
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-gray-400">Nichts gefunden</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handleSelect(String(o.value))}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-green-50 ${
                    String(o.value) === String(value) ? "bg-green-50 text-green-800 font-medium" : "text-gray-800"
                  }`}
                >
                  {o.label}
                  {o.sub && <span className="text-gray-400 ml-1.5 text-xs">{o.sub}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
