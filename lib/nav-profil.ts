/**
 * lib/nav-profil.ts
 * Baut die Navigationsstruktur (components/Nav.tsx `groups`) gemäß dem Nav-Profil der
 * eingestellten Betriebsart um: Gruppen umbenennen, die Einträge einer `section` in eine
 * eigene Top-Level-Gruppe herauslösen, Gruppen umsortieren.
 *
 * Bewusst eine reine Funktion ohne Imports (unit-testbar, client-sicher). Sie wird in
 * Nav.tsx VOR der Modul-/Permission-Filterung angewandt — andernfalls bliebe eine
 * herausgelöste Gruppe mit leerer Kinderliste stehen, statt von der bestehenden Regel
 * "Gruppe ohne Kinder verschwindet" mit erfasst zu werden.
 */

export interface NavProfilChild {
  href: string;
  label: string;
  section?: string;
}

export interface NavProfilGroup {
  label: string;
  href?: string;
  children?: NavProfilChild[];
}

export interface NavProfilRegeln {
  gruppenLabels?: Record<string, string>;
  eigeneGruppen?: {
    label: string;
    ausGruppe: string;
    section: string;
    /** Zusätzlich die komplette Kinderliste dieser Gruppe übernehmen; die Gruppe selbst
     *  entfällt danach. Damit wird aus zwei sehr schmalen Gruppen eine sinnvolle —
     *  z.B. "Eierhandel" + der nach dem Modulfilter allein übrige Tier-Eintrag. */
    auchAusGruppe?: string;
  }[];
  reihenfolge?: string[];
}

/**
 * Sortiert `gruppen` nach `reihenfolge`. Gelistete Gruppen wandern in genau diese
 * Reihenfolge nach vorn; nicht gelistete behalten ihre relative Position und hängen
 * hinten an — so entzieht ein unvollständiges Profil keiner Gruppe ihren Platz.
 */
function sortiereNachReihenfolge<T extends { label: string }>(gruppen: T[], reihenfolge: string[]): T[] {
  const genannt: T[] = [];
  for (const label of reihenfolge) {
    const treffer = gruppen.filter((g) => g.label === label);
    genannt.push(...treffer);
  }
  const rest = gruppen.filter((g) => !reihenfolge.includes(g.label));
  return [...genannt, ...rest];
}

export function wendeNavProfilAn<T extends NavProfilGroup>(
  gruppen: T[],
  profil: NavProfilRegeln | undefined,
): NavProfilGroup[] {
  if (!profil) return gruppen;

  let ergebnis: NavProfilGroup[] = gruppen.map((g) => ({ ...g, children: g.children ? [...g.children] : undefined }));

  // 1) Sections in eigene Top-Level-Gruppen herauslösen.
  for (const regel of profil.eigeneGruppen ?? []) {
    const quelle = ergebnis.find((g) => g.label === regel.ausGruppe);
    if (!quelle?.children) continue;
    const herausgeloest = quelle.children.filter((c) => c.section === regel.section);
    if (herausgeloest.length === 0) continue;
    quelle.children = quelle.children.filter((c) => c.section !== regel.section);

    if (regel.auchAusGruppe) {
      const zweite = ergebnis.find((g) => g.label === regel.auchAusGruppe);
      if (zweite?.children) {
        herausgeloest.push(...zweite.children);
        ergebnis = ergebnis.filter((g) => g !== zweite);
      }
    }
    // Direkt hinter der Quellgruppe einsortieren; `reihenfolge` darf danach umsortieren.
    const pos = ergebnis.indexOf(quelle);
    ergebnis.splice(pos + 1, 0, { label: regel.label, children: herausgeloest });
  }

  // 2) Gruppen umbenennen (nach dem Herauslösen — `ausGruppe` bezieht sich auf das
  //    Original-Label, `reihenfolge` dagegen auf das fertige, umbenannte Label).
  if (profil.gruppenLabels) {
    const labels = profil.gruppenLabels;
    ergebnis = ergebnis.map((g) => (labels[g.label] ? { ...g, label: labels[g.label] } : g));
  }

  // 3) Umsortieren.
  if (profil.reihenfolge) ergebnis = sortiereNachReihenfolge(ergebnis, profil.reihenfolge);

  return ergebnis;
}
