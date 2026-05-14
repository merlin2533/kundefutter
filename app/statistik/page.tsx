import Link from "next/link";

function StatTile({ href, icon, title, description }: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 sm:p-5 bg-white border border-gray-200 rounded-xl hover:border-green-400 hover:shadow-md transition-all group active:bg-green-50"
    >
      <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-800 group-hover:text-green-700">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </Link>
  );
}

interface Tile {
  href: string;
  icon: string;
  title: string;
  description: string;
}

interface Section {
  title: string;
  description: string;
  tiles: Tile[];
}

const SECTIONS: Section[] = [
  {
    title: "Überblick",
    description: "Gesamtbild über Umsatz, Marge und Kennzahlen.",
    tiles: [
      { href: "/statistik/uebersicht", icon: "📊", title: "Statistik-Dashboard", description: "KPIs, Umsatz nach Monat, Vorjahresvergleich, offene Posten, Lager" },
      { href: "/statistik/saisonal", icon: "🗓️", title: "Saisonale Auswertung", description: "Umsatzverteilung über das Jahr, Saisonmuster erkennen" },
    ],
  },
  {
    title: "Kunden & Artikel",
    description: "Detailauswertungen mit Zeitraum- und Kategorie-Filter.",
    tiles: [
      { href: "/statistik/kunden", icon: "👥", title: "Kundenauswertung", description: "Umsatz, Marge und Lieferungen je Kunde – filterbar nach Zeitraum & Kategorie" },
      { href: "/statistik/artikel", icon: "📦", title: "Artikelauswertung", description: "Umsatz, Menge und Marge je Artikel – filterbar nach Zeitraum & Kategorie" },
      { href: "/statistik/abc", icon: "🔤", title: "ABC-Analyse", description: "Kunden und Artikel nach Umsatzanteil klassifiziert (A/B/C)" },
      { href: "/kunden/bewertung", icon: "⭐", title: "Kundenbewertung", description: "RFM-Analyse: Aktualität, Häufigkeit, Umsatz je Kunde" },
    ],
  },
  {
    title: "Finanzen & Planung",
    description: "Ergebnis, Deckungsbeitrag und Vorausschau.",
    tiles: [
      { href: "/statistik/deckungsbeitrag", icon: "💶", title: "Deckungsbeitrag", description: "Deckungsbeitrags-Analyse nach Kunde und Artikel" },
      { href: "/statistik/budget", icon: "🎯", title: "Budgetplanung", description: "Umsatzziele setzen und Soll/Ist-Vergleich je Monat und Kategorie" },
      { href: "/finanzen/cashflow", icon: "💸", title: "Cashflow", description: "Liquiditätsentwicklung aus Ein- und Ausgaben" },
      { href: "/prognose", icon: "🔮", title: "Prognose", description: "Bedarfs- und Absatzprognose je Kunde/Artikel" },
      { href: "/marktpreise", icon: "📈", title: "Marktpreise", description: "Eurostat-Preisindizes und MATIF-Futures" },
    ],
  },
];

export default function StatistikHubPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Statistik & Auswertungen</h1>
      <p className="text-sm text-gray-500 mb-6 sm:mb-8">
        Wähle eine Auswertung. Jede Detailseite hat eigene Filter für Zeitraum und Themen.
      </p>

      <div className="space-y-8 sm:space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <div className="mb-3 sm:mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {section.title}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">{section.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {section.tiles.map((tile) => (
                <StatTile key={tile.href} {...tile} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
