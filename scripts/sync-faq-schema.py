#!/usr/bin/env python3
"""Erzeugt den FAQPage-JSON-LD-Block einer Landingpage aus ihrer SICHTBAREN FAQ.

Googles FAQPage-Richtlinie verlangt, dass jede ausgezeichnete Frage samt Antwort
auf der Seite sichtbar ist. Werden Schema und Markup getrennt gepflegt, laufen sie
zwangsläufig auseinander — auf web/index.html standen zeitweise 23 Fragen im Schema
gegen 21 auf der Seite, und ein kaputtes Anführungszeichen hatte den gesamten Block
über Monate ungültig gemacht, ohne dass es jemandem auffiel.

Deshalb: Die sichtbare FAQ ist die Quelle der Wahrheit, das Schema wird generiert.

    python3 scripts/sync-faq-schema.py web/index.html web/eierhandel.html

Idempotent — ein zweiter Lauf ohne FAQ-Änderung ändert nichts. Mit --check wird
nur geprüft (Exit-Code 1 bei Abweichung), ohne zu schreiben; so lässt es sich auch
in einer Pipeline verwenden.
"""
import argparse
import html
import io
import json
import re
import sys

FAQ_ITEM = re.compile(
    r'<div class="faq-item[^"]*">\s*<div class="faq-question".*?<span>(.*?)</span>.*?'
    r'<div class="faq-answer">\s*<div class="faq-answer-inner">(.*?)</div>',
    re.S,
)


def sichtbare_faq(seite: str) -> list[tuple[str, str]]:
    """Liest Frage/Antwort-Paare aus den .faq-item-Blöcken der Seite."""
    def text(fragment: str) -> str:
        return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", fragment))).strip()

    return [(text(m.group(1)), text(m.group(2))) for m in FAQ_ITEM.finditer(seite)]


def block_grenzen(seite: str) -> tuple[int, int]:
    """Findet den FAQPage-JSON-Block per Klammerzählung (Regex reicht dafür nicht)."""
    start = seite.index("<!-- Structured Data: FAQPage -->")
    auf = seite.index("{", seite.index('<script type="application/ld+json">', start))
    tiefe, i = 0, auf
    while True:
        if seite[i] == "{":
            tiefe += 1
        elif seite[i] == "}":
            tiefe -= 1
        if tiefe == 0:
            return auf, i + 1
        i += 1


def schema_aus_faq(faq: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": frage,
                "acceptedAnswer": {"@type": "Answer", "text": antwort},
            }
            for frage, antwort in faq
        ],
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("dateien", nargs="+", help="HTML-Landingpages mit FAQPage-Block")
    p.add_argument("--check", action="store_true", help="nur prüfen, nichts schreiben")
    args = p.parse_args()

    abweichungen = 0
    for pfad in args.dateien:
        seite = io.open(pfad, encoding="utf-8").read()
        faq = sichtbare_faq(seite)
        if not faq:
            print(f"{pfad}: keine .faq-item-Blöcke gefunden — Datei übersprungen", file=sys.stderr)
            abweichungen += 1
            continue

        auf, zu = block_grenzen(seite)
        neu = json.dumps(schema_aus_faq(faq), ensure_ascii=False, indent=2)
        alt = seite[auf:zu]

        if alt == neu:
            print(f"{pfad}: {len(faq)} Fragen, Schema bereits synchron")
            continue

        abweichungen += 1
        if args.check:
            print(f"{pfad}: Schema weicht von der sichtbaren FAQ ab ({len(faq)} Fragen sichtbar)")
            continue

        io.open(pfad, "w", encoding="utf-8").write(seite[:auf] + neu + seite[zu:])
        print(f"{pfad}: Schema aus {len(faq)} sichtbaren Fragen neu geschrieben")

    return 1 if (args.check and abweichungen) else 0


if __name__ == "__main__":
    raise SystemExit(main())
