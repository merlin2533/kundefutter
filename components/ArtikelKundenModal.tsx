"use client";

import ArtikelKundenUebersicht from "@/components/ArtikelKundenUebersicht";

interface Props {
  artikelId: number;
  artikelName: string;
  open: boolean;
  onClose: () => void;
}

export default function ArtikelKundenModal({ artikelId, artikelName, open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Kunden zu {artikelName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Wer hat diesen Artikel bekommen oder noch offen?</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4"
          >
            &times;
          </button>
        </div>

        <ArtikelKundenUebersicht artikelId={artikelId} />
      </div>
    </div>
  );
}
