"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { useToast } from "@/components/ToastProvider";
import { formatDatum } from "@/lib/utils";

interface Staffel {
  id: number; saison: string; kategorie?: string | null; artikelId?: number | null;
  bestellfrist: string; rabattProzent: number;
  beschreibung?: string | null; aktiv: boolean;
  artikel?: { id: number; name: string } | null;
}

export default function Page() {
  const toast = useToast();
  const [liste, setListe] = useState<Staffel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    saison: `Frühjahr ${new Date().getFullYear()}`,
    kategorie: "",
    bestellfrist: "",
    rabattProzent: "",
    beschreibung: "",
  });

  function laden() {
    fetch("/api/fruehbezugsstaffel").then(r => r.json()).then(d => setListe(Array.isArray(d) ? d : []));
  }
  useEffect(() => { laden(); }, []);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bestellfrist) { toast.error("Bestellfrist erforderlich"); return; }
    const res = await fetch("/api/fruehbezugsstaffel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, rabattProzent: Number(form.rabattProzent) }),
    });
    if (res.ok) {
      toast.success("Staffel gespeichert");
      setShowForm(false);
      setForm({ saison: `Frühjahr ${new Date().getFullYear()}`, kategorie: "", bestellfrist: "", rabattProzent: "", beschreibung: "" });
      laden();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Fehler");
    }
  }

  async function toggleAktiv(s: Staffel) {
    const r = await fetch(`/api/fruehbezugsstaffel?id=${s.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktiv: !s.aktiv }),
    });
    if (r.ok) laden();
  }
  async function loeschen(id: number) {
    if (!confirm("Staffel löschen?")) return;
    const r = await fetch(`/api/fruehbezugsstaffel?id=${id}`, { method: "DELETE" });
    if (r.ok) laden();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/einstellungen" className="text-sm text-gray-500 hover:underline">← Einstellungen</Link>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">⏱ Frühbezugs-Staffeln</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
          {showForm ? "Abbrechen" : "+ Neue Staffel"}
        </button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <form onSubmit={speichern} className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Saison *</label>
              <input required type="text" value={form.saison} onChange={e => setForm({ ...form, saison: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kategorie (optional)</label>
              <select value={form.kategorie} onChange={e => setForm({ ...form, kategorie: e.target.value })} className="w-full border rounded px-3 py-2">
                <option value="">Alle</option>
                <option value="Saatgut">Saatgut</option>
                <option value="Duenger">Dünger</option>
                <option value="Futter">Futter</option>
                <option value="Pflege">Pflege</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bestellfrist *</label>
              <input required type="date" value={form.bestellfrist} onChange={e => setForm({ ...form, bestellfrist: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rabatt (%) *</label>
              <input required type="number" step="0.1" min="0" max="100" value={form.rabattProzent} onChange={e => setForm({ ...form, rabattProzent: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Beschreibung</label>
              <input type="text" value={form.beschreibung} onChange={e => setForm({ ...form, beschreibung: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="z.B. Frühbezugs-Aktion Saatgut" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">Staffel speichern</button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left border-b"><th>Saison</th><th>Kategorie</th><th>Artikel</th><th>Bestellfrist</th><th>Rabatt</th><th>Beschreibung</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {liste.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-6 text-gray-500">Noch keine Staffeln definiert.</td></tr>
              ) : liste.map(s => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 pr-3">{s.saison}</td>
                  <td className="py-2 pr-3">{s.kategorie ?? "alle"}</td>
                  <td className="py-2 pr-3">{s.artikel?.name ?? "–"}</td>
                  <td className="py-2 pr-3">{formatDatum(s.bestellfrist)}</td>
                  <td className="py-2 pr-3 font-semibold text-green-700">{s.rabattProzent}%</td>
                  <td className="py-2 pr-3">{s.beschreibung ?? "–"}</td>
                  <td className="py-2 pr-3">
                    <button onClick={() => toggleAktiv(s)} className={`text-xs px-2 py-0.5 rounded ${s.aktiv ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {s.aktiv ? "aktiv" : "inaktiv"}
                    </button>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <button onClick={() => loeschen(s.id)} className="text-red-600 hover:underline text-sm">Löschen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
