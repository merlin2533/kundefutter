-- CreateTable
CREATE TABLE "ArtikelInhaltsstoff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "menge" REAL,
    "einheit" TEXT,
    CONSTRAINT "ArtikelInhaltsstoff_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ArtikelInhaltsstoff_artikelId_idx" ON "ArtikelInhaltsstoff"("artikelId");

-- CreateIndex
CREATE INDEX "ArtikelInhaltsstoff_name_idx" ON "ArtikelInhaltsstoff"("name");

-- Update FTS5: Drop old triggers, recreate virtual table with inhaltsstoffe, new triggers
DROP TRIGGER IF EXISTS artikel_fts_insert;
DROP TRIGGER IF EXISTS artikel_fts_update;
DROP TRIGGER IF EXISTS artikel_fts_delete;
DROP TABLE IF EXISTS artikel_fts;

CREATE VIRTUAL TABLE IF NOT EXISTS artikel_fts USING fts5(
  artikel_id UNINDEXED,
  name,
  artikelnummer,
  kategorie,
  inhaltsstoffe,
  content='Artikel',
  content_rowid='id'
);

-- Triggers: inhaltsstoffe via subquery (group_concat of related ArtikelInhaltsstoff names)
CREATE TRIGGER IF NOT EXISTS artikel_fts_insert AFTER INSERT ON Artikel BEGIN
  INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
  VALUES (
    new.id, new.id, new.name, new.artikelnummer, new.kategorie,
    COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = new.id), '')
  );
END;

CREATE TRIGGER IF NOT EXISTS artikel_fts_update AFTER UPDATE ON Artikel BEGIN
  INSERT INTO artikel_fts(artikel_fts, rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
  VALUES ('delete', old.id, old.id, old.name, old.artikelnummer, old.kategorie,
    COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = old.id), ''));
  INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
  VALUES (
    new.id, new.id, new.name, new.artikelnummer, new.kategorie,
    COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = new.id), '')
  );
END;

CREATE TRIGGER IF NOT EXISTS artikel_fts_delete AFTER DELETE ON Artikel BEGIN
  INSERT INTO artikel_fts(artikel_fts, rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
  VALUES ('delete', old.id, old.id, old.name, old.artikelnummer, old.kategorie,
    COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = old.id), ''));
END;

-- Triggers on ArtikelInhaltsstoff to keep FTS in sync when ingredients change
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

-- Repopulate FTS index
INSERT INTO artikel_fts(rowid, artikel_id, name, artikelnummer, kategorie, inhaltsstoffe)
SELECT a.id, a.id, a.name, a.artikelnummer, a.kategorie,
  COALESCE((SELECT group_concat(ai.name, ', ') FROM ArtikelInhaltsstoff ai WHERE ai.artikelId = a.id), '')
FROM Artikel a;
