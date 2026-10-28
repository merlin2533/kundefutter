-- Explizite Lieferadresse "ans Lager" für Lieferantenbestellungen — bisher zeigte die Bestellung
-- nur bei automatisch erkanntem Streckengeschäft (alle Positionen derselben Kundenauftrag) eine
-- Lieferadresse; für den normalen Fall "Ware kommt zu uns" gab es keine. `lieferLagerort` speichert
-- bewusst nur den Namen (wie Artikel.lagerort, Auflösung der Adresse live gegen
-- system.lagerortAdressen) statt einer eigenen Relation — Lagerorte sind reine Einstellung, kein
-- DB-Modell.
ALTER TABLE "Bestellung" ADD COLUMN "lieferLagerort" TEXT;
