"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = 1 | 2 | 3 | 4 | 5;

interface FirmaDaten {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  steuernummer: string;
  ustIdNr: string;
  iban: string;
  bic: string;
}

interface ArtikelDaten {
  name: string;
  einheit: string;
  standardpreis: string;
  kategorie: string;
}

interface KundeDaten {
  name: string;
  telefon: string;
}

async function saveSetting(key: string, value: string) {
  await fetch("/api/einstellungen", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [firma, setFirma] = useState<FirmaDaten>({
    name: "", strasse: "", plz: "", ort: "", telefon: "", email: "",
    steuernummer: "", ustIdNr: "", iban: "", bic: "",
  });

  const [artikel, setArtikel] = useState<ArtikelDaten>({
    name: "", einheit: "kg", standardpreis: "", kategorie: "Sonstige",
  });

  const [kunde, setKunde] = useState<KundeDaten>({ name: "", telefon: "" });

  function updateFirma(key: keyof FirmaDaten, value: string) {
    setFirma((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFirmaWeiter() {
    if (!firma.name) { setError("Firmenname ist erforderlich."); return; }
    setLoading(true);
    setError("");
    try {
      await Promise.all([
        saveSetting("firma.name", firma.name),
        saveSetting("system.firmenname", firma.name),
        firma.strasse && saveSetting("firma.strasse", firma.strasse),
        firma.plz && saveSetting("firma.plz", firma.plz),
        firma.ort && saveSetting("firma.ort", firma.ort),
        firma.telefon && saveSetting("firma.tel", firma.telefon),
        firma.email && saveSetting("firma.email", firma.email),
        firma.steuernummer && saveSetting("firma.steuernummer", firma.steuernummer),
        firma.ustIdNr && saveSetting("firma.ustIdNr", firma.ustIdNr),
        firma.iban && saveSetting("firma.iban", firma.iban),
        firma.bic && saveSetting("firma.bic", firma.bic),
      ].filter(Boolean));
      setStep(3);
    } catch {
      setError("Fehler beim Speichern der Firmendaten.");
    } finally {
      setLoading(false);
    }
  }

  async function handleArtikelWeiter() {
    setLoading(true);
    setError("");
    try {
      if (artikel.name) {
        const preis = parseFloat(artikel.standardpreis.replace(",", ".")) || 0;
        const res = await fetch("/api/artikel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: artikel.name,
            einheit: artikel.einheit,
            standardpreis: preis,
            kategorie: artikel.kategorie,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Fehler beim Anlegen des Artikels.");
          setLoading(false);
          return;
        }
      }
      setStep(4);
    } catch {
      setError("Netzwerkfehler beim Anlegen des Artikels.");
    } finally {
      setLoading(false);
    }
  }

  async function handleKundeWeiter() {
    setLoading(true);
    setError("");
    try {
      if (kunde.name) {
        const kontakte = kunde.telefon
          ? [{ typ: "telefon", wert: kunde.telefon }]
          : [];
        const res = await fetch("/api/kunden", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: kunde.name,
            kategorie: "Sonstige",
            kontakte,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Fehler beim Anlegen des Kunden.");
          setLoading(false);
          return;
        }
      }
      // Mark onboarding as done
      await saveSetting("system.onboarding_done", "1");
      setStep(5);
    } catch {
      setError("Netzwerkfehler beim Anlegen des Kunden.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  const STEPS = [
    { n: 1, label: "Willkommen" },
    { n: 2, label: "Firmendaten" },
    { n: 3, label: "Erster Artikel" },
    { n: 4, label: "Erster Kunde" },
    { n: 5, label: "Fertig" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 sm:p-8">
        {/* Progress indicator */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s.n ? "bg-green-700 text-white" :
                step > s.n ? "bg-green-200 text-green-800" :
                "bg-gray-200 text-gray-500"
              }`}>
                {step > s.n ? "✓" : s.n}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-1 rounded transition-colors ${step > s.n ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Willkommen */}
        {step === 1 && (
          <div className="text-center space-y-4">
            <div className="text-5xl mb-2">🌱</div>
            <h1 className="text-2xl font-bold text-gray-900">Herzlich willkommen bei AGRI-Office!</h1>
            <p className="text-gray-600 leading-relaxed">
              Füllen Sie in 4 Schritten die wichtigsten Stammdaten aus, um AGRI-Office für Ihren Betrieb einzurichten.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm text-left mt-4">
              {[["2", "Firmendaten"], ["3", "Erster Artikel"], ["4", "Erster Kunde"], ["5", "Fertig!"]].map(([n, label]) => (
                <div key={n} className="flex items-center gap-2 text-gray-500">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold text-xs flex items-center justify-center">{n}</span>
                  {label}
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="mt-4 w-full px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold transition-colors"
            >
              Einrichtung starten →
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Überspringen – direkt zum Dashboard
            </button>
          </div>
        )}

        {/* Step 2: Firmendaten */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Firmendaten</h2>
              <p className="text-sm text-gray-500 mt-1">Diese Daten erscheinen auf Ihren Rechnungen und Dokumenten.</p>
            </div>
            <div>
              <label className={labelCls}>Firmenname / Betrieb *</label>
              <input type="text" value={firma.name} onChange={(e) => updateFirma("name", e.target.value)}
                placeholder="Agrarhandel Müller GbR" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Straße</label>
                <input type="text" value={firma.strasse} onChange={(e) => updateFirma("strasse", e.target.value)}
                  placeholder="Dorfstraße 12" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>PLZ</label>
                  <input type="text" value={firma.plz} onChange={(e) => updateFirma("plz", e.target.value)}
                    placeholder="12345" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ort</label>
                  <input type="text" value={firma.ort} onChange={(e) => updateFirma("ort", e.target.value)}
                    placeholder="Musterstadt" className={inputCls} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Telefon</label>
                <input type="text" value={firma.telefon} onChange={(e) => updateFirma("telefon", e.target.value)}
                  placeholder="0123 456789" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>E-Mail</label>
                <input type="email" value={firma.email} onChange={(e) => updateFirma("email", e.target.value)}
                  placeholder="info@agrarhandel.de" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Steuernummer</label>
                <input type="text" value={firma.steuernummer} onChange={(e) => updateFirma("steuernummer", e.target.value)}
                  placeholder="123/456/78901" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>USt-IdNr.</label>
                <input type="text" value={firma.ustIdNr} onChange={(e) => updateFirma("ustIdNr", e.target.value)}
                  placeholder="DE123456789" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>IBAN</label>
                <input type="text" value={firma.iban} onChange={(e) => updateFirma("iban", e.target.value)}
                  placeholder="DE89 3704 0044 0532 0130 00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>BIC</label>
                <input type="text" value={firma.bic} onChange={(e) => updateFirma("bic", e.target.value)}
                  placeholder="COBADEFFXXX" className={inputCls} />
              </div>
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <button onClick={handleFirmaWeiter} disabled={loading}
              className="w-full px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold transition-colors disabled:opacity-60">
              {loading ? "Speichern…" : "Weiter →"}
            </button>
          </div>
        )}

        {/* Step 3: Erster Artikel */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Erster Artikel</h2>
              <p className="text-sm text-gray-500 mt-1">Legen Sie Ihren ersten Artikel an (optional – Sie können diesen Schritt auch überspringen).</p>
            </div>
            <div>
              <label className={labelCls}>Artikelname</label>
              <input type="text" value={artikel.name} onChange={(e) => setArtikel((p) => ({ ...p, name: e.target.value }))}
                placeholder="z.B. Maissaat KWS" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Einheit</label>
                <select value={artikel.einheit} onChange={(e) => setArtikel((p) => ({ ...p, einheit: e.target.value }))}
                  className={inputCls + " bg-white"}>
                  {["kg", "t", "Sack", "Liter", "Stück"].map((e) => <option key={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Standardpreis (€)</label>
                <input type="text" value={artikel.standardpreis}
                  onChange={(e) => setArtikel((p) => ({ ...p, standardpreis: e.target.value }))}
                  placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Kategorie</label>
                <select value={artikel.kategorie} onChange={(e) => setArtikel((p) => ({ ...p, kategorie: e.target.value }))}
                  className={inputCls + " bg-white"}>
                  {["Futter", "Duenger", "Saatgut", "Analysen", "Beratung", "Pflege", "Sonstige"].map((k) => <option key={k}>{k}</option>)}
                </select>
              </div>
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-3">
              <button onClick={handleArtikelWeiter} disabled={loading}
                className="flex-1 px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold transition-colors disabled:opacity-60">
                {loading ? "Speichern…" : artikel.name ? "Artikel anlegen & weiter →" : "Überspringen →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Erster Kunde */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Erster Kunde</h2>
              <p className="text-sm text-gray-500 mt-1">Legen Sie Ihren ersten Kunden an (optional – kann auch übersprungen werden).</p>
            </div>
            <div>
              <label className={labelCls}>Name des Kunden</label>
              <input type="text" value={kunde.name} onChange={(e) => setKunde((p) => ({ ...p, name: e.target.value }))}
                placeholder="z.B. Landwirtschaft Müller" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input type="text" value={kunde.telefon} onChange={(e) => setKunde((p) => ({ ...p, telefon: e.target.value }))}
                placeholder="0123 456789" className={inputCls} />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-3">
              <button onClick={handleKundeWeiter} disabled={loading}
                className="flex-1 px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold transition-colors disabled:opacity-60">
                {loading ? "Speichern…" : kunde.name ? "Kunde anlegen & fertigstellen →" : "Überspringen →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Fertig */}
        {step === 5 && (
          <div className="text-center space-y-4">
            <div className="text-5xl mb-2">✅</div>
            <h2 className="text-2xl font-bold text-gray-900">AGRI-Office ist eingerichtet!</h2>
            <p className="text-gray-600 leading-relaxed">
              Herzlichen Glückwunsch! Ihr AGRI-Office ist einsatzbereit. Sie können jetzt loslegen.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-4">
              {[
                { href: "/kunden/neu", label: "Weiteren Kunden anlegen" },
                { href: "/artikel/neu", label: "Weiteren Artikel anlegen" },
                { href: "/lieferungen/neu", label: "Erste Lieferung erstellen" },
                { href: "/einstellungen", label: "Einstellungen" },
              ].map((link) => (
                <Link key={link.href} href={link.href}
                  className="px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg font-medium transition-colors text-center">
                  {link.label}
                </Link>
              ))}
            </div>
            <Link href="/"
              className="mt-4 block w-full px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold transition-colors">
              Zum Dashboard →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
