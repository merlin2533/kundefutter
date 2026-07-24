"use client";

import { useState } from "react";
import { parseDezimal } from "@/lib/utils";

interface DezimalInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
}

function format(v: number): string {
  return Number.isFinite(v) ? String(v).replace(".", ",") : "";
}

/**
 * Zahlen-Eingabefeld mit deutscher Komma-Eingabe (z.B. "12,50").
 * type="number" lehnt das Komma browserabhängig ab; ein type="text", dessen
 * Wert bei jedem Tastendruck sofort neu geparst und zurückformatiert wird,
 * springt direkt nach dem Komma auf den gerundeten Wert zurück und
 * verschluckt die Nachkommastellen beim Weitertippen. Deshalb: eigener
 * Rohtext-Puffer, der erst beim Verlassen des Felds normalisiert wird —
 * onChange liefert trotzdem bei jedem Tastendruck bereits den geparsten
 * Zahlenwert nach außen.
 */
export default function DezimalInput({ value, onChange, placeholder, className }: DezimalInputProps) {
  const [text, setText] = useState(() => format(value));
  const [focused, setFocused] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  // Puffer aus dem Prop nachziehen, wenn sich der Wert von außen ändert
  // (z.B. Artikelauswahl setzt einen Standardpreis) — aber nur solange das
  // Feld nicht gerade fokussiert ist, sonst würde eigenes Tippen überschrieben.
  // Direkt im Render-Body statt in einem useEffect angepasst (React-Pattern
  // "Adjusting state when a prop changes"), damit kein zusätzlicher Render-Tick
  // nötig ist.
  if (!focused && value !== lastValue) {
    setLastValue(value);
    setText(format(value));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseDezimal(e.target.value));
      }}
      onBlur={() => {
        setFocused(false);
        setLastValue(value);
        setText(format(value));
      }}
      className={className}
    />
  );
}
