import Link from "next/link";

function EinstellungTile({ href, icon, title, description }: {
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

interface Tile { href: string; icon: string; title: string; description: string; }

const KATEGORIEN: { label: string; tiles: Tile[] }[] = [
  {
    label: "Betrieb & System",
    tiles: [
      { href: "/einstellungen/firma", icon: "🏢", title: "Firma", description: "Name, Adresse und Kontaktdaten" },
      { href: "/einstellungen/erscheinungsbild", icon: "🎨", title: "Erscheinungsbild", description: "Logo, Favicon und Design" },
      { href: "/einstellungen/system", icon: "⚙️", title: "System", description: "Version, Datenbank und Diagnose" },
      { href: "/einstellungen/backup", icon: "💾", title: "Datensicherung", description: "Datenbank-Backups erstellen und verwalten" },
      { href: "/einstellungen/benutzer", icon: "👥", title: "Benutzer", description: "Benutzerkonten, Rollen und Zugriffsrechte verwalten" },
      { href: "/audit", icon: "📜", title: "Änderungshistorie", description: "Alle Änderungen an Stammdaten nachverfolgen" },
    ],
  },
  {
    label: "Stammdaten",
    tiles: [
      { href: "/einstellungen/stammdaten", icon: "📂", title: "Stammdaten", description: "Kundenkategorien, Mitarbeiter, Lieferanten-Einstellungen" },
      { href: "/einstellungen/artikelkategorien", icon: "🏷️", title: "Artikelkategorien", description: "Artikel-Kategorien anlegen, umbenennen und löschen" },
      { href: "/einstellungen/lieferanten", icon: "🚚", title: "Lieferanten", description: "Standard-Zahlungskonditionen und Lieferbedingungen" },
      { href: "/einstellungen/lager", icon: "📦", title: "Lager", description: "Mindestbestände, Alarme und Kategorien" },
      { href: "/einstellungen/tournamen", icon: "🚛", title: "Tour-Namen", description: "Gespeicherte Tourbezeichnungen" },
      { href: "/einstellungen/nummernkreis", icon: "🔢", title: "Artikelnummer", description: "Präfix, Stellenanzahl und nächste Nummer konfigurieren" },
      { href: "/einstellungen/bankkonten", icon: "🏦", title: "Bankkonten", description: "Konten für den Bankabgleich hinterlegen" },
    ],
  },
  {
    label: "Finanzen & Vertrieb",
    tiles: [
      { href: "/einstellungen/ausgaben", icon: "🧾", title: "Ausgaben", description: "Kategorien für Betriebsausgaben konfigurieren" },
      { href: "/einstellungen/datev", icon: "📊", title: "DATEV", description: "Beraternummer, Mandantennummer und Kontenrahmen" },
      { href: "/einstellungen/fruehbezug", icon: "⏱", title: "Frühbezugs-Staffeln", description: "Saison-Rabatte für Vorbestellungen pflegen (z.B. -3% bis 31.07.)" },
      { href: "/einstellungen/benachrichtigungen", icon: "🔔", title: "Benachrichtigungen", description: "System-Alerts konfigurieren (Sachkunde, Kreditlimit, Lager, Rechnungen)" },
    ],
  },
  {
    label: "Pflanze & Tier",
    tiles: [
      { href: "/einstellungen/agrarantraege", icon: "🌾", title: "Agraranträge (AFIG)", description: "CSV von agrarzahlungen.de importieren" },
      { href: "/einstellungen/futterwerte", icon: "🐄", title: "Futterwerte", description: "Eigene Futtermittel für die Rationsberechnung anlegen und pflegen" },
    ],
  },
  {
    label: "Integrationen",
    tiles: [
      { href: "/einstellungen/email", icon: "✉️", title: "E-Mail-Versand", description: "SMTP oder Resend für Rechnungsversand (PDF + ZUGFeRD)" },
      { href: "/einstellungen/ki", icon: "🤖", title: "KI / AI", description: "API-Keys, Modellauswahl und Nutzungsstatistik" },
      { href: "/einstellungen/google-drive", icon: "📁", title: "Google Drive", description: "Dokumente für Kunden und Artikel in Drive ablegen" },
    ],
  },
  {
    label: "Import & Daten",
    tiles: [
      { href: "/einstellungen/import", icon: "📥", title: "Import", description: "Kunden, Artikel und Stammdaten aus Excel-Dateien importieren" },
      { href: "/einstellungen/artikel-import", icon: "🌿", title: "Artikel-Stammdaten", description: "marstall & BvG Agrar Artikel manuell importieren" },
      { href: "/einstellungen/adressen", icon: "🗺️", title: "Adress-Validierung", description: "Geocoding für alle Kundenadressen" },
      { href: "/inventur", icon: "📋", title: "Inventur", description: "Lagerbestand erfassen, Leerliste drucken, Differenzen buchen" },
    ],
  },
];

export default function EinstellungenPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 sm:mb-8">Einstellungen</h1>

      <div className="space-y-8">
        {KATEGORIEN.map((kat) => (
          <section key={kat.label}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
              {kat.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {kat.tiles.map((t) => (
                <EinstellungTile key={t.href} {...t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
