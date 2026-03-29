# PRD: Google Drive Integration — AgrarOffice Röthemeier

**Version:** 1.0
**Datum:** 2026-03-29
**Branch:** `claude/google-drive-integration-prd-KeuMu`
**Status:** Entwurf

---

## 1. Zusammenfassung

Google Drive wird als Dokumentenablage in AgrarOffice integriert. Ziel ist es, dass pro Kunde, pro Artikel und für zentrale Dokumente automatisch Google Drive-Ordner verknüpft werden — ohne manuelle Ordnerverwaltung. Mitarbeiter greifen direkt aus der App auf Angebote, Verträge, Lieferscheine, Datenblätter und Zertifikate zu.

---

## 2. Problemstellung

Aktuell existieren Dokumente verstreut auf lokalen Rechnern, per E-Mail oder in manuell gepflegten Ordnerstrukturen. Es gibt keine zentrale, aus der App heraus zugängliche Ablage. Bei Kundengesprächen fehlt der schnelle Zugriff auf relevante Dokumente.

---

## 3. Ziele

| Ziel | Messbarkeit |
|------|-------------|
| Jeder Kunde hat einen automatisch erstellten Drive-Ordner | Ordner wird beim ersten Aufruf der Kundendetailseite angelegt |
| Jeder Artikel hat einen automatisch erstellten Drive-Ordner | Ordner wird beim ersten Aufruf der Artikeldetailseite angelegt |
| Zentrale Ordner (Verträge, Vorlagen, Zertifikate) sind aus der App erreichbar | Links in Einstellungen konfigurierbar |
| Dokumente können ohne App-Wechsel angezeigt und hochgeladen werden | Embed oder direkter Drive-Link in der App |

---

## 4. Nicht in Scope (Version 1.0)

- Volltextsuche in Drive-Dokumenten
- Automatische Synchronisation von Lieferschein-PDFs nach Drive
- Offline-Verfügbarkeit von Drive-Dokumenten
- Rechteverwaltung einzelner Dokumente pro Mitarbeiter

---

## 5. Nutzerszenarien

### 5.1 Kundengespräch vorbereiten
> Vertriebsmitarbeiter öffnet Kundendetailseite → Tab „Dokumente" → sieht alle Dateien im Kunden-Ordner (Angebote, Verträge, Gesprächsnotizen) → kann direkt eine Datei öffnen oder hochladen.

### 5.2 Artikel-Datenblatt abrufen
> Mitarbeiter öffnet Artikeldetailseite → Tab „Dokumente" → findet Sicherheitsdatenblatt, Zertifikat, Produktbild → öffnet Datei im Browser.

### 5.3 Vorlage aus zentralem Ordner nutzen
> Mitarbeiter öffnet Einstellungen → Google Drive → klickt auf „Zentrale Dokumente" → wird direkt zu konfigurierten Drive-Ordnern geleitet.

---

## 6. Technische Architektur

### 6.1 Authentifizierung: OAuth2 mit zentralem Google-Account

**Entscheidung: OAuth2 mit einem zentralen Google-Account** (einmalig autorisiert)

```
Google Cloud Project (OAuth2 App)
  └── Einmaliger Admin-Login → Refresh Token wird in DB gespeichert
        └── App nutzt Refresh Token für alle Drive-Operationen
```

**Flow:**
1. Admin öffnet `/einstellungen/google-drive`
2. Klickt „Mit Google verbinden" → OAuth2-Redirect zu Google
3. Admin meldet sich mit dem zentralen Google-Account an und erteilt Zugriff
4. Google liefert `access_token` + `refresh_token` zurück
5. `refresh_token` wird verschlüsselt in `Einstellung` (Key: `system.google.refreshToken`) gespeichert
6. Ab sofort authentifiziert sich die App serverseitig über diesen Token — kein erneuter Login nötig

**Vorteile gegenüber Service Account:**
- Kein technischer JSON-Key nötig — normaler Google-Account reicht
- Drive-Ordner erscheinen in der gewohnten Google Drive Oberfläche des Accounts
- Einfacher einzurichten (kein Google Cloud IAM-Wissen nötig)

**Google Cloud Konfiguration (einmalig):**
- OAuth2 Client ID + Secret in Google Cloud Console erstellen
- Redirect URI: `http://194.164.59.48:8080/api/drive/oauth/callback`
- Scopes: `https://www.googleapis.com/auth/drive`
- Client ID + Secret als Umgebungsvariablen: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### 6.2 Ordnerstruktur in Google Drive

```
AgrarOffice/
├── Kunden/
│   ├── Müller GbR (kundeId: abc123)/
│   ├── Schulze & Söhne (kundeId: def456)/
│   └── ...
├── Artikel/
│   ├── Weizensaatgut Elite (artikelId: ghi789)/
│   └── ...
└── Zentral/
    ├── Verträge/
    ├── Vorlagen/
    └── Zertifikate/
```

- Ordner-IDs werden in der Datenbank gespeichert (neue Felder `driveOrderId`)
- Beim ersten Zugriff: Ordner automatisch anlegen + ID speichern
- Umbenennung des Kunden/Artikels → Ordnername in Drive wird synchronisiert

### 6.3 Datenbankänderungen (Prisma)

```prisma
model Kunde {
  // ... bestehende Felder
  driveOrdnerId   String?   // Google Drive Folder ID
}

model Artikel {
  // ... bestehende Felder
  driveOrdnerId   String?   // Google Drive Folder ID
}

// In Einstellung (Key/Value):
// system.google.refreshToken       → OAuth2 Refresh Token (verschlüsselt)
// system.google.rootOrdnerId       → ID des Root-Ordners "AgrarOffice"
// system.google.kundenOrdnerId     → ID des Ordners "Kunden"
// system.google.artikelOrdnerId    → ID des Ordners "Artikel"
// system.google.zentralOrdnerIds   → JSON-Array [{name, id}]
```

### 6.4 API-Routen (neu)

```
/api/drive/oauth/login              GET — Redirect zu Google OAuth2
/api/drive/oauth/callback           GET — OAuth2 Callback, speichert Refresh Token
/api/drive/status                   GET — Verbindungstest, zeigt ob Drive konfiguriert
/api/drive/kunden/[id]/dateien      GET — Dateiliste des Kunden-Ordners
/api/drive/kunden/[id]/upload       POST — Datei-Upload in Kunden-Ordner
/api/drive/artikel/[id]/dateien     GET — Dateiliste des Artikel-Ordners
/api/drive/artikel/[id]/upload      POST — Datei-Upload in Artikel-Ordner
/api/drive/zentral                  GET — Liste der konfigurierten Zentralordner
/api/drive/setup                    POST — Root-Ordnerstruktur initialisieren
```

### 6.5 Frontend-Komponenten

#### `components/DriveOrdner.tsx`
Wiederverwendbare Komponente für Kunden- und Artikel-Tabs:

```tsx
<DriveOrdner
  entityType="kunde" | "artikel"
  entityId="..."
  entityName="Müller GbR"
/>
```

Zeigt:
- Dateiliste mit Icon, Name, Datum, Dateigröße
- „Datei hochladen"-Button (Drag & Drop)
- „In Drive öffnen"-Link (öffnet Drive-Ordner in neuem Tab)
- Ladezustand + Fehlerbehandlung bei fehlender Konfiguration

#### Einbindung in bestehende Tabs
- `app/kunden/[id]/page.tsx` → neuer Tab **„Dokumente"** (zwischen Notizen und Agrarantrag)
- `app/artikel/[id]/page.tsx` → neuer Tab **„Dokumente"**

### 6.6 Einstellungsseite

Neue Kachel in `/einstellungen/page.tsx`:

| Kachel | Seite | Inhalt |
|--------|-------|--------|
| **Google Drive** | `/einstellungen/google-drive` | Service Account, Root-Ordner, Zentrale Ordner |

Unterseite `/einstellungen/google-drive/page.tsx`:
- Service Account JSON hochladen/hinterlegen
- Verbindungstest-Button
- Root-Ordner-ID konfigurieren (oder „Ordner neu erstellen")
- Zentrale Ordner definieren (Name + Drive-Ordner-ID oder Drive-Link)
- Anzeige: Wie viele Kunden-/Artikel-Ordner bereits verknüpft sind

---

## 7. Sicherheit

| Risiko | Maßnahme |
|--------|----------|
| Refresh Token in DB | AES-verschlüsselt in `Einstellung` speichern, nie in API-Antworten zurückgeben |
| Drive-API-Aufrufe serverseitig | Kein Token gelangt zum Browser |
| Datei-Upload-Validierung | MIME-Type + Größenlimit (z.B. 25 MB) serverseitig prüfen |
| Ordner-IDs in API | Nur eigene Entity-IDs akzeptieren (keine fremden Folder-IDs abrufbar) |

---

## 8. Abhängigkeiten / Pakete

```json
"googleapis": "^144.0.0"
```

Kein weiteres SDK nötig — `googleapis` deckt Drive v3 vollständig ab.

---

## 9. Implementierungsplan

### Phase 1 — Infrastruktur (3–4 Tage)
1. [ ] `googleapis` installieren
2. [ ] Prisma-Schema: `driveOrdnerId` zu `Kunde` und `Artikel` hinzufügen + Migration
3. [ ] `lib/googleDrive.ts` — Service Account Auth, Ordner erstellen/abrufen, Dateiliste, Upload
4. [ ] API-Routen `/api/drive/*` implementieren
5. [ ] Einstellungsseite `/einstellungen/google-drive/page.tsx` + neue Kachel

### Phase 2 — UI (2–3 Tage)
6. [ ] `components/DriveOrdner.tsx` implementieren
7. [ ] Tab „Dokumente" in Kundendetail einbinden
8. [ ] Tab „Dokumente" in Artikeldetail einbinden
9. [ ] Zentrale Ordner in Einstellungen konfigurierbar machen

### Phase 3 — Polish (1 Tag)
10. [ ] Fehlerbehandlung (Drive nicht konfiguriert → freundlicher Hinweis mit Link zu Einstellungen)
11. [ ] Ladezustände, leere Zustände
12. [ ] Mobile-Responsive (Dateiliste kompakt auf kleinen Screens)

---

## 10. Offene Fragen

| Frage | Entscheidung erforderlich von |
|-------|-------------------------------|
| ~~Service Account oder OAuth2 pro Nutzer?~~ | **Entschieden: OAuth2 mit zentralem Account** |
| Shared Drive oder normales „Meine Ablage"? | Admin — „Meine Ablage" des zentralen Accounts reicht für Einstieg |
| Maximale Upload-Dateigröße? | Betreiber |
| Sollen PDF-Lieferscheine automatisch in den Kunden-Ordner hochgeladen werden (Phase 2)? | Produktentscheidung |
| Sind Mitarbeiter-Accounts in Google Workspace vorhanden? | Admin — beeinflusst Auth-Modell |

---

## 11. Akzeptanzkriterien

- [ ] Google Drive lässt sich über Einstellungen konfigurieren (Service Account Key hinterlegen, testen)
- [ ] Beim ersten Öffnen eines Kunden-Tabs „Dokumente" wird automatisch ein Ordner in Drive angelegt
- [ ] Bestehende Dateien im Ordner werden als Liste angezeigt (Name, Datum, Größe)
- [ ] Eine Datei kann direkt aus der App hochgeladen werden
- [ ] Per Klick öffnet sich der Drive-Ordner in einem neuen Browser-Tab
- [ ] Ohne Konfiguration wird ein erklärender Hinweis angezeigt (kein Fehler-Crash)
- [ ] Zentrale Ordner sind in den Einstellungen definierbar und im Nav verlinkt
