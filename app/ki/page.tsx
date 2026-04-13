import Link from "next/link";

const KI_KACHELN = [
  {
    href: "/ki/wareneingang",
    icon: (
      <svg className="w-8 h-8 text-green-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
    titel: "KI-Wareneingang",
    beschreibung: "Lieferschein fotografieren – KI erkennt Artikel, Mengen und Preise automatisch.",
  },
  {
    href: "/ki/lieferung",
    icon: (
      <svg className="w-8 h-8 text-blue-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
    titel: "KI-Lieferung",
    beschreibung: "Bestellung oder Lieferdokument hochladen – KI erstellt Lieferpositionen.",
  },
  {
    href: "/ki/crm",
    icon: (
      <svg className="w-8 h-8 text-purple-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    titel: "KI-CRM",
    beschreibung: "Gesprächsnotizen oder Fotos hochladen – KI erfasst CRM-Aktivitäten.",
  },
];

export default function KiUebersichtPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">KI-Assistenten</h1>
      <p className="text-gray-500 text-sm mb-8">
        Nutzen Sie künstliche Intelligenz zur schnellen Erfassung von Belegen und Notizen.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {KI_KACHELN.map((k) => (
          <Link
            key={k.href}
            href={k.href}
            className="group flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 hover:border-green-400 hover:shadow-md transition-all"
          >
            <div className="w-14 h-14 rounded-xl bg-gray-50 group-hover:bg-green-50 flex items-center justify-center transition-colors">
              {k.icon}
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">{k.titel}</p>
              <p className="text-sm text-gray-500 leading-snug">{k.beschreibung}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
