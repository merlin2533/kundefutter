"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Static label mapping for known route segments
const SEGMENT_LABELS: Record<string, string> = {
  kunden: "Kunden",
  artikel: "Artikel",
  lieferungen: "Lieferungen",
  lieferanten: "Lieferanten",
  angebote: "Angebote",
  aufgaben: "Aufgaben",
  crm: "CRM / Aktivitäten",
  lager: "Lager",
  einstellungen: "Einstellungen",
  tourenplanung: "Tourenplanung",
  marktpreise: "Marktpreise",
  agrarantraege: "Agraranträge",
  gebietsanalyse: "Gebietsanalyse",
  prognose: "Prognose",
  exporte: "Exporte",
  mengenrabatte: "Mengenrabatte",
  telefonmaske: "Telefonmaske",
  tagesansicht: "Tagesansicht",
  preisauskunft: "Preisauskunft",
  inventur: "Inventur",
  statistik: "Statistik",
  analyse: "Analyse",
  audit: "Änderungshistorie",
  kalkulation: "Preiskalkulation",
  rechnungen: "Rechnungen",
  mahnwesen: "Mahnwesen",
  gutschriften: "Gutschriften",
  kundenimport: "Import",
  mailverteiler: "Mailverteiler",
  neu: "Neu",
  bearbeiten: "Bearbeiten",
  mappe: "Kundenmappe",
  lieferschein: "Lieferschein",
  rechnung: "Rechnung",
  druck: "Druckansicht",
  firma: "Firma",
  erscheinungsbild: "Erscheinungsbild",
  adressen: "Adressen",
  tournamen: "Tour-Namen",
  system: "System",
  stammdaten: "Stammdaten",
  chargen: "Chargenrückverfolgung",
  wareneingang: "Wareneingang",
  umbuchungen: "Umbuchungen",
  abc: "ABC-Analyse",
  saisonal: "Saisonalanalyse",
  deckungsbeitrag: "Deckungsbeitrag",
  bewertung: "Kundenbewertung",
  karte: "Karte",
};

// Routes where we look up names from API
type EntityRoute = "kunden" | "artikel" | "lieferungen" | "angebote" | "aufgaben" | "lieferanten";

async function fetchEntityName(entity: EntityRoute, id: string): Promise<string> {
  try {
    const res = await fetch(`/api/${entity}/${id}`);
    if (!res.ok) return id;
    const data = await res.json();
    switch (entity) {
      case "kunden":
        return data.firma ?? data.name ?? id;
      case "artikel":
        return data.name ?? id;
      case "lieferungen":
        return data.rechnungNr ? `Lieferung ${data.rechnungNr}` : `Lieferung #${id}`;
      case "angebote":
        return data.nummer ?? `Angebot #${id}`;
      case "aufgaben":
        return data.betreff ?? `Aufgabe #${id}`;
      case "lieferanten":
        return data.name ?? id;
      default:
        return id;
    }
  } catch {
    return id;
  }
}

const ENTITY_ROUTES = new Set<EntityRoute>([
  "kunden",
  "artikel",
  "lieferungen",
  "angebote",
  "aufgaben",
  "lieferanten",
]);

function isEntityRoute(s: string): s is EntityRoute {
  return ENTITY_ROUTES.has(s as EntityRoute);
}

interface Crumb {
  label: string;
  href: string;
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const [dynamicLabels, setDynamicLabels] = useState<Record<string, string>>({});

  // Don't show on dashboard
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);

  // Build crumb list
  const crumbs: Crumb[] = [{ label: "Dashboard", href: "/" }];
  let currentPath = "";
  let parentEntity: EntityRoute | null = null;
  let parentId: string | null = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;

    const isId = /^\d+$/.test(seg);

    if (isId && parentEntity) {
      // Dynamic entity name
      const key = `${parentEntity}/${seg}`;
      const label = dynamicLabels[key] ?? `#${seg}`;
      crumbs.push({ label, href: currentPath });
      parentId = seg;
    } else {
      const label = SEGMENT_LABELS[seg] ?? seg;
      crumbs.push({ label, href: currentPath });
      if (isEntityRoute(seg)) {
        parentEntity = seg;
      } else if (!isId) {
        // Reset parentId for sub-paths like /mappe, /druck unless still under same entity
        parentId = null;
      }
    }
  }

  // Fetch dynamic labels for numeric IDs
  useEffect(() => {
    const toFetch: { entity: EntityRoute; id: string; key: string }[] = [];
    let entity: EntityRoute | null = null;

    for (const seg of segments) {
      if (isEntityRoute(seg)) {
        entity = seg;
      } else if (/^\d+$/.test(seg) && entity) {
        const key = `${entity}/${seg}`;
        if (!dynamicLabels[key]) {
          toFetch.push({ entity, id: seg, key });
        }
      }
    }

    if (toFetch.length === 0) return;

    let cancelled = false;
    Promise.all(
      toFetch.map(async ({ entity, id, key }) => {
        const name = await fetchEntityName(entity, id);
        return { key, name };
      })
    ).then((results) => {
      if (cancelled) return;
      setDynamicLabels((prev) => {
        const updated = { ...prev };
        for (const { key, name } of results) updated[key] = name;
        return updated;
      });
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="bg-gray-50 border-b border-gray-200 px-4 md:px-6 py-1.5"
    >
      <ol className="flex items-center flex-wrap gap-x-1 gap-y-0.5 max-w-screen-2xl mx-auto text-xs text-gray-500">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-gray-400 select-none" aria-hidden>
                  &rsaquo;
                </span>
              )}
              {isLast ? (
                <span className="font-medium text-gray-700">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-green-700 hover:underline transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
