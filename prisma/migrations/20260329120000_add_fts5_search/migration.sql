-- FTS5 virtual tables for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS kunden_fts USING fts5(
  kunde_id UNINDEXED,
  name,
  firma,
  plz,
  ort,
  content='Kunde',
  content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS artikel_fts USING fts5(
  artikel_id UNINDEXED,
  name,
  artikelnummer,
  kategorie,
  content='Artikel',
  content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS kunden_fts_insert AFTER INSERT ON Kunde BEGIN
  INSERT INTO kunden_fts(rowid, kunde_id, name, firma, plz, ort)
  VALUES (new.id, new.id, new.name, COALESCE(new.firma, ''), COALESCE(new.plz, ''), COALESCE(new.ort, ''));
END;

CREATE TRIGGER IF NOT EXISTS kunden_fts_update AFTER UPDATE ON Kunde BEGIN
  INSERT INTO kunden_fts(kunden_fts, rowid, kunde_id, name, firma, plz, ort)
  VALUES ('delete', old.id, old.id, old.name, COALESCE(old.firma, ''), COALESCE(old.plz, ''), COALESCE(old.ort, ''));
  INSERT INTO kunden_fts(rowid, kunde_id, name, firma, plz, ort)
  VALUES (new.id, new.id, new.name, COALESCE(new.firma, ''), COALESCE(new.plz, ''), COALESCE(new.ort, ''));
END;

CREATE TRIGGER IF NOT EXISTS kunden_fts_delete AFTER DELETE ON Kunde BEGIN
  INSERT INTO kunden_fts(kunden_fts, rowid, kunde_id, name, firma, plz, ort)
  VALUES ('delete', old.id, old.id, old.name, COALESCE(old.firma, ''), COALESCE(old.plz, ''), COALESCE(old.ort, ''));
END;

CREATE TRIGGER IF NOT EXISTS artikel_fts_insert AFTER INSERT ON Artikel BEGIN
  INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie)
  VALUES (new.id, new.id, new.name, new.artikelnummer, new.kategorie);
END;

CREATE TRIGGER IF NOT EXISTS artikel_fts_update AFTER UPDATE ON Artikel BEGIN
  INSERT INTO artikel_fts(artikel_fts, rowid, artikel_id, name, artikelnummer, kategorie)
  VALUES ('delete', old.id, old.id, old.name, old.artikelnummer, old.kategorie);
  INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie)
  VALUES (new.id, new.id, new.name, new.artikelnummer, new.kategorie);
END;

CREATE TRIGGER IF NOT EXISTS artikel_fts_delete AFTER DELETE ON Artikel BEGIN
  INSERT INTO artikel_fts(artikel_fts, rowid, artikel_id, name, artikelnummer, kategorie)
  VALUES ('delete', old.id, old.id, old.name, old.artikelnummer, old.kategorie);
END;

-- Initial population
INSERT INTO kunden_fts(rowid, kunde_id, name, firma, plz, ort)
SELECT id, id, name, COALESCE(firma, ''), COALESCE(plz, ''), COALESCE(ort, '') FROM Kunde;

INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie)
SELECT id, id, name, artikelnummer, kategorie FROM Artikel;
