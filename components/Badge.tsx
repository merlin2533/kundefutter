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
  const labels: Record<string, string> = {
    geplant: "Auftrag",
    geliefert: "Lieferschein",
    storniert: "Storniert",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-800"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function GutschriftStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OFFEN: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    VERBUCHT: "bg-green-100 text-green-800 border border-green-200",
    STORNIERT: "bg-red-100 text-red-600 border border-red-200",
    ERSTATTET: "bg-blue-100 text-blue-800 border border-blue-200",
  };
  const labels: Record<string, string> = {
    OFFEN: "Offen",
    VERBUCHT: "Verbucht",
    STORNIERT: "Storniert",
    ERSTATTET: "Erstattet",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-800"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function AngebotStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OFFEN: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    ANGENOMMEN: "bg-green-100 text-green-800 border border-green-200",
    ABGELEHNT: "bg-red-100 text-red-800 border border-red-200",
    ABGELAUFEN: "bg-red-200 text-red-900 border border-red-300 font-semibold",
  };
  const labels: Record<string, string> = {
    OFFEN: "Offen",
    ANGENOMMEN: "Angenommen",
    ABGELEHNT: "Abgelehnt",
    ABGELAUFEN: "Abgelaufen",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-800"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function VersendetBadge() {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-800 border border-teal-200">
      ✓ Versendet
    </span>
  );
}

export function AuditAktionBadge({ aktion }: { aktion: string }) {
  const colors: Record<string, string> = {
    erstellt: "bg-green-100 text-green-800",
    geaendert: "bg-blue-100 text-blue-800",
    geloescht: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[aktion] ?? "bg-gray-100 text-gray-700"}`}>
      {aktion}
    </span>
  );
}

export function MargeBadge({
  pct,
  warnungProzent = 10,
  fehlerProzent = 0,
}: {
  pct: number;
  warnungProzent?: number;
  fehlerProzent?: number;
}) {
  const cls =
    pct < fehlerProzent
      ? "bg-red-100 text-red-800"
      : pct < warnungProzent
      ? "bg-orange-100 text-orange-800"
      : "bg-green-100 text-green-800";
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>{pct.toFixed(1)} %</span>
  );
}
