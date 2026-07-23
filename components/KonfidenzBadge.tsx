import type { Konfidenz } from "@/lib/kiMatching";

export default function KonfidenzBadge({ k }: { k: Konfidenz }) {
  if (k === "gelernt")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
        Gelernt ✓
      </span>
    );
  if (k === "hoch")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Hoch
      </span>
    );
  if (k === "mittel")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
        Mittel
      </span>
    );
  if (k === "niedrig")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
        Niedrig
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
      Keine
    </span>
  );
}
