"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/kunden", label: "Kunden" },
  { href: "/kunden/karte", label: "Karte" },
  { href: "/artikel", label: "Artikel" },
  { href: "/lieferanten", label: "Lieferanten" },
  { href: "/lager", label: "Lager" },
  { href: "/lieferungen", label: "Lieferungen" },
  { href: "/prognose", label: "Prognose" },
  { href: "/exporte", label: "Export" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="bg-green-800 text-white shadow-md">
      <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-6 flex-wrap">
        <span className="font-bold text-lg tracking-tight whitespace-nowrap">🌾 KundeFutter</span>
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-green-800"
                    : "hover:bg-green-700 text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
