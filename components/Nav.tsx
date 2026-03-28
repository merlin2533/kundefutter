"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  { href: "/mahnwesen", label: "Mahnwesen" },
  { href: "/mengenrabatte", label: "Mengenrabatte" },
  { href: "/statistik", label: "Statistik" },
  { href: "/einstellungen", label: "Einstellungen" },
  { href: "/kundenimport", label: "Kundenimport" },
  { href: "/tourenplanung", label: "Tourenplanung" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/kunden") return pathname === "/kunden" || (pathname.startsWith("/kunden/") && !pathname.startsWith("/kunden/karte"));
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="bg-green-800 text-white shadow-md">
      <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight whitespace-nowrap leading-tight">
          <span className="text-white">AgrarOffice</span>
          <span className="text-green-300 text-xs font-normal ml-1.5 hidden sm:inline">Röthemeier</span>
        </span>

        {/* Desktop nav */}
        <nav className="hidden md:flex flex-wrap gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? "bg-white text-green-800"
                  : "hover:bg-green-700 text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded hover:bg-green-700 transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menü öffnen"
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="md:hidden border-t border-green-700 px-4 py-2 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? "bg-white text-green-800"
                  : "hover:bg-green-700 text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
