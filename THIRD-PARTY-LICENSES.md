# Verwendete Lizenzen (Drittanbieter)

AGRI-Office nutzt die folgenden Open-Source-Bibliotheken. Alle eingesetzten
Laufzeit-Abhängigkeiten stehen unter permissiven Lizenzen (MIT, Apache-2.0,
BSD, ISC, MIT-0). Stand: 2026-06-02, App-Version 1.0.0.

## Laufzeit-Abhängigkeiten

| Paket | Version | Lizenz |
|---|---|---|
| @anthropic-ai/sdk | 0.82.0 | MIT |
| @libsql/client | 0.17.2 | MIT |
| @prisma/adapter-libsql | 7.6.0 | Apache-2.0 |
| @prisma/client | 7.6.0 | Apache-2.0 |
| bcryptjs | 3.0.3 | BSD-3-Clause |
| googleapis | 144.0.0 | Apache-2.0 |
| jose | 6.2.2 | MIT |
| jspdf | 4.2.1 | MIT |
| jspdf-autotable | 5.0.7 | MIT |
| jszip | 3.10.1 | MIT OR GPL-3.0-or-later |
| leaflet | 1.9.4 | BSD-2-Clause |
| lucide-react | 1.7.0 | ISC |
| next | 16.2.10 | MIT |
| nodemailer | 9.0.3 | MIT-0 |
| openai | 6.33.0 | Apache-2.0 |
| pdf-lib | 1.17.1 | MIT |
| prisma | 7.7.0 | Apache-2.0 |
| qrcode | 1.5.4 | MIT |
| react | 19.2.4 | MIT |
| react-dom | 19.2.4 | MIT |
| react-leaflet | 5.0.0 | Hippocratic-2.1 |
| resend | 6.12.4 | MIT |
| xlsx | 0.20.3 | Apache-2.0 |

## Hinweise

- **jszip** ist dual-lizenziert (MIT ODER GPL-3.0-or-later); AGRI-Office nutzt
  die Bibliothek unter den Bedingungen der **MIT**-Lizenz.
- **react-leaflet** steht unter der Hippocratic License 2.1 (eine ethische
  MIT-Variante). Die Lizenz ist mit der hier vorliegenden geschäftlichen
  Nutzung vereinbar.
- **nodemailer** nutzt MIT-0 (MIT ohne Namensnennungspflicht).

## Externe Datenquellen & Dienste (APIs)

| Dienst | Zweck | Bedingungen |
|---|---|---|
| OpenStreetMap / Nominatim | Geocodierung | ODbL – Namensnennung erforderlich |
| OSRM | Routenberechnung | öffentliche Demo-API |
| Eurostat REST API | Agrarrohstoff-Preisindizes | freie Nachnutzung mit Quellenangabe |
| Open-Meteo | Wetter-/Spritzfenster-Prognose | CC BY 4.0 |
| Yahoo Finance | MATIF-Futures (Euronext) | nur informativ |
| OpenAI / Anthropic | KI-Funktionen (optional) | gemäß jeweiligem API-Vertrag |

> Eine maschinenlesbare Übersicht der Lizenzen kann jederzeit mit
> `npx license-checker --summary` erzeugt werden.
