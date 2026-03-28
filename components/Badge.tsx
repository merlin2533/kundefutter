export function LagerBadge({ status }: { status: "gruen" | "gelb" | "rot" }) {
  const cls =
    status === "gruen" ? "ampel-gruen" : status === "gelb" ? "ampel-gelb" : "ampel-rot";
  const label = status === "gruen" ? "OK" : status === "gelb" ? "Niedrig" : "Leer";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    geplant: "bg-blue-100 text-blue-800 border border-blue-200",
    geliefert: "bg-green-100 text-green-800 border border-green-200",
    storniert: "bg-gray-100 text-gray-500 border border-gray-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}

export function MargeBadge({ pct }: { pct: number }) {
  const cls =
    pct < 0 ? "bg-red-100 text-red-800" : pct < 10 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800";
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>{pct.toFixed(1)} %</span>
  );
}
