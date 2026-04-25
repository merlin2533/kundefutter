import Link from "next/link";

function ImportTile({ href, icon, title, description, vorlage }: {
  href: string;
  icon: string;
  title: string;
  description: string;
  vorlage?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-green-400 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-4">
        <Link href={href} className="flex-1 min-w-0">
          <div className="text-3xl mb-3">{icon}</div>
          <h3 className="font-semibold text-gray-800 group-hover:text-green-700">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </Link>
        {vorlage && (
          <a
            href={vorlage}
            download
            title="Vorlage herunterladen"
            className="shrink-0 mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            ⬇ Vorlage
          </a>
        )}
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Import</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">Import</h1>
      <p className="text-sm text-gray-500 mb-8">
        Stammdaten aus Excel-Dateien importieren. Über "Vorlage" eine Muster-Datei herunterladen.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ImportTile
          href="/einstellungen/import/kunden"
          icon="👥"
          title="Kunden importieren"
          description="Kundenstammdaten aus Excel laden. Felder: Name, Vorname, Firma, Adresse, Telefon, Mobil, Fax, E-Mail, Notizen."
          vorlage="/api/kundenimport"
        />
        <ImportTile
          href="/einstellungen/artikel-import"
          icon="📦"
          title="Artikel importieren"
          description="Artikel-Stammdaten aus Excel laden oder vordefinierte marstall & BvG-Agrar Artikel importieren."
          vorlage="/api/einstellungen/artikel-import?action=template"
        />
        <ImportTile
          href="/einstellungen/import/preisliste"
          icon="💶"
          title="Preisliste importieren"
          description="Einfache 2-Spalten-Preisliste je Lieferant: Artikelname (mit Gebindegröße) und EK-Preis."
          vorlage="/api/einstellungen/preisliste-import?action=template"
        />
      </div>
    </div>
  );
}
