export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  color = "green",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "green" | "blue" | "yellow" | "red";
}) {
  const colors = {
    green: "border-l-4 border-green-500",
    blue: "border-l-4 border-blue-500",
    yellow: "border-l-4 border-yellow-500",
    red: "border-l-4 border-red-500",
  };
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${colors[color]}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
