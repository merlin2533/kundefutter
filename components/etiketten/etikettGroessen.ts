// Geteilte Etiketten-Größen — aus app/lager/etiketten/page.tsx extrahiert, damit
// app/eiersortierung/etiketten/page.tsx (Eierkarton-Etiketten, Modul eierhandel) dieselben
// Werte nutzt statt sie zu duplizieren.
export type EtikettGroesse = "50x30" | "70x40" | "100x50";

export const GROESSEN: { value: EtikettGroesse; label: string; width: string; height: string }[] = [
  { value: "50x30", label: "50×30 mm (Standard)", width: "50mm", height: "30mm" },
  { value: "70x40", label: "70×40 mm (Mittel)", width: "70mm", height: "40mm" },
  { value: "100x50", label: "100×50 mm (Groß)", width: "100mm", height: "50mm" },
];

// Eierkarton-Etiketten tragen mehr Pflichtangaben (Güte-/Gewichtsklasse, Haltungsform in
// Worten, Legedatum, MHD, Erzeugercode, Eieranzahl, Kühlhinweis, ggf. Packstellen-
// Zulassungsnummer) als ein generisches Lager-Etikett — 50×30mm ist dafür zu klein, um lesbar
// zu bleiben. Nur die beiden größeren Formate anbieten.
export const EI_GROESSEN = GROESSEN.filter((g) => g.value !== "50x30");
