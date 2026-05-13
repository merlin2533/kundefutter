-- Recreate ArtikelInhaltsstoff FTS5 triggers to ensure correctness
-- (idempotent: DROP IF EXISTS + CREATE IF NOT EXISTS)

DROP TRIGGER IF EXISTS inhaltsstoff_fts_insert;
DROP TRIGGER IF EXISTS inhaltsstoff_fts_delete;

CREATE TRIGGER IF NOT EXISTS inhaltsstoff_fts_insert AFTER INSERT ON ArtikelInhaltsstoff BEGIN
  INSERT INTO artikel_fts(artikel_fts, rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
  VALUES ('delete',
    (SELECT id FROM Artikel WHERE id = new.artikelId),
    new.artikelId,
    (SELECT name FROM Artikel WHERE id = new.artikelId),
    (SELECT artikelnummer FROM Artikel WHERE id = new.artikelId),
    (SELECT kategorie FROM Artikel WHERE id = new.artikelId),
    COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = new.artikelId AND ai.id != new.id), ''));
  INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
  VALUES (
    new.artikelId, new.artikelId,
    (SELECT name FROM Artikel WHERE id = new.artikelId),
    (SELECT artikelnummer FROM Artikel WHERE id = new.artikelId),
    (SELECT kategorie FROM Artikel WHERE id = new.artikelId),
    COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = new.artikelId), ''));
END;

CREATE TRIGGER IF NOT EXISTS inhaltsstoff_fts_delete AFTER DELETE ON ArtikelInhaltsstoff BEGIN
  INSERT INTO artikel_fts(artikel_fts, rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
  VALUES ('delete',
    old.artikelId, old.artikelId,
    (SELECT name FROM Artikel WHERE id = old.artikelId),
    (SELECT artikelnummer FROM Artikel WHERE id = old.artikelId),
    (SELECT kategorie FROM Artikel WHERE id = old.artikelId),
    COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = old.artikelId), ''));
  INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
  VALUES (
    old.artikelId, old.artikelId,
    (SELECT name FROM Artikel WHERE id = old.artikelId),
    (SELECT artikelnummer FROM Artikel WHERE id = old.artikelId),
    (SELECT kategorie FROM Artikel WHERE id = old.artikelId),
    COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = old.artikelId AND ai.id != old.id), ''));
END;
