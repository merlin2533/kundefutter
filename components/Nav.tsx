"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

interface NavGroup {
  label: string;
  href?: string;
  children?: { href: string; label: string }[];
}

const groups: NavGroup[] = [
  { label: "Dashboard", href: "/" },
  {
    label: "Kunden",
    children: [
      { href: "/kunden", label: "Kundenliste" },
      { href: "/kunden/karte", label: "Karte" },
      { href: "/kundenimport", label: "Import" },
      { href: "/crm", label: "CRM / Aktivitäten" },
      { href: "/gebietsanalyse", label: "Gebietsanalyse" },
      { href: "/agrarantraege", label: "Agraranträge (AFIG)" },
      { href: "/mailverteiler", label: "Mailverteiler" },
    ],
  },
  {
    label: "Artikel",
    children: [
      { href: "/artikel", label: "Artikelstamm" },
      { href: "/lieferanten", label: "Lieferanten" },
      { href: "/lager", label: "Lager" },
      { href: "/lager/umbuchungen", label: "Umbuchungen" },
      { href: "/inventur", label: "Inventur" },
      { href: "/kalkulation", label: "Preiskalkulation" },
    ],
  },
  {
    label: "Lieferungen",
    children: [
      { href: "/angebote", label: "Angebote" },
      { href: "/aufgaben", label: "Aufgaben / TODO" },
      { href: "/lieferungen", label: "Lieferungen" },
      { href: "/tourenplanung", label: "Tourenplanung" },
    ],
  },
  {
    label: "Finanzen",
    children: [
      { href: "/rechnungen", label: "Rechnungen" },
      { href: "/mahnwesen", label: "Mahnwesen" },
      { href: "/mengenrabatte", label: "Mengenrabatte" },
      { href: "/exporte", label: "Export" },
    ],
  },
  {
    label: "Analyse",
    children: [
      { href: "/statistik", label: "Statistik" },
      { href: "/prognose", label: "Prognose" },
      { href: "/marktpreise", label: "Marktpreise" },
      { href: "/analyse/abc", label: "ABC-Analyse" },
      { href: "/analyse/saisonal", label: "Saisonal" },
      { href: "/analyse/deckungsbeitrag", label: "Deckungsbeitrag" },
    ],
  },
  { label: "Einstellungen", href: "/einstellungen" },
];

function DropdownItem({ group, isAnyChildActive }: { group: NavGroup; isAnyChildActive: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          isAnyChildActive ? "bg-white text-green-800" : "hover:bg-green-700 text-white"
        }`}
      >
        {group.label}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[150px] z-50">
          {group.children!.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.logo"]) setLogo(d["system.logo"]);
      })
      .catch(() => {});
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/kunden") return pathname === "/kunden" || (pathname.startsWith("/kunden/") && !pathname.startsWith("/kunden/karte"));
    return pathname === href || pathname.startsWith(href + "/");
  }

  function isGroupActive(group: NavGroup) {
    if (group.href) return isActive(group.href);
    return group.children?.some((c) => isActive(c.href)) ?? false;
  }

  return (
    <header className="bg-green-800 text-white shadow-md">
      <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
        {logo ? (
          <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
        ) : (
          <span className="font-bold text-lg tracking-tight whitespace-nowrap leading-tight">
            <span className="text-white">AgrarOffice</span>
            <span className="text-green-300 text-xs font-normal ml-1.5 hidden sm:inline">Röthemeier</span>
          </span>
        )}

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {groups.map((g) =>
            g.href ? (
              <Link
                key={g.href}
                href={g.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isGroupActive(g) ? "bg-white text-green-800" : "hover:bg-green-700 text-white"
                }`}
              >
                {g.label}
              </Link>
            ) : (
              <DropdownItem key={g.label} group={g} isAnyChildActive={isGroupActive(g)} />
            )
          )}
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
          {groups.map((g) =>
            g.href ? (
              <Link
                key={g.href}
                href={g.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                  isGroupActive(g) ? "bg-white text-green-800" : "hover:bg-green-700 text-white"
                }`}
              >
                {g.label}
              </Link>
            ) : (
              <div key={g.label}>
                <button
                  onClick={() => setMobileOpen(mobileOpen === g.label ? null : g.label)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                    isGroupActive(g) ? "bg-white/20 text-white" : "hover:bg-green-700 text-white"
                  }`}
                >
                  <span>{g.label}</span>
                  <svg className={`w-4 h-4 transition-transform ${mobileOpen === g.label ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {mobileOpen === g.label && (
                  <div className="ml-4 mt-1 flex flex-col gap-0.5">
                    {g.children!.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={() => { setOpen(false); setMobileOpen(null); }}
                        className={`px-3 py-2 rounded text-sm transition-colors ${
                          isActive(c.href) ? "bg-white text-green-800 font-medium" : "hover:bg-green-700 text-green-100"
                        }`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </nav>
      )}
    </header>
  );
}

