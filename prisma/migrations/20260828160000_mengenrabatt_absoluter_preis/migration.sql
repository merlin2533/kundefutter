-- Mengenrabatt: absoluter Verkaufspreis ab einer Menge als primäre, neue Eingabeart
-- (statt Rabatt in %). rabattProzent bleibt als Legacy-Feld für bereits bestehende
-- prozentbasierte Staffeln erhalten -- neue Staffeln werden über "preis" definiert.
ALTER TABLE "Mengenrabatt" ADD COLUMN "preis" REAL;
