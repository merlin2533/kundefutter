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
      className="block p-5 bg-white border border-gray-200 rounded-xl hover:border-green-400 hover:shadow-md transition-all group"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-800 group-hover:text-green-700">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </Link>
  );
}

export default function EinstellungenPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">Einstellungen</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <EinstellungTile
          href="/einstellungen/firma"
          icon="🏢"
          title="Firma"
          description="Name, Adresse und Kontaktdaten"
        />
        <EinstellungTile
          href="/einstellungen/erscheinungsbild"
          icon="🎨"
          title="Erscheinungsbild"
          description="Logo, Favicon und Design"
        />
        <EinstellungTile
          href="/einstellungen/lager"
          icon="📦"
          title="Lager"
          description="Mindestbestände, Alarme und Kategorien"
        />
        <EinstellungTile
          href="/einstellungen/adressen"
          icon="🗺️"
          title="Adress-Validierung"
          description="Geocoding für alle Kundenadressen"
        />
        <EinstellungTile
          href="/einstellungen/tournamen"
          icon="🚛"
          title="Tour-Namen"
          description="Gespeicherte Tourbezeichnungen"
        />
        <EinstellungTile
          href="/einstellungen/system"
          icon="⚙️"
          title="System"
          description="Version, Datenbank und Diagnose"
        />
        <EinstellungTile
          href="/inventur"
          icon="📋"
          title="Inventur"
          description="Lagerbestand erfassen, Leerliste drucken, Differenzen buchen"
        />
        <EinstellungTile
          href="/einstellungen/stammdaten"
          icon="📂"
          title="Stammdaten"
          description="Kundenkategorien, Mitarbeiter, Lieferanten-Einstellungen"
        />
        <EinstellungTile
          href="/einstellungen/lieferanten"
          icon="🚚"
          title="Lieferanten"
          description="Standard-Zahlungskonditionen und Lieferbedingungen"
        />
      </div>
    </div>
  );
}
