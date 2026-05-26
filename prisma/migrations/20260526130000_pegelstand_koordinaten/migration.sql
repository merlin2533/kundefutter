-- AlterTable: Koordinaten für Kartenanzeige
ALTER TABLE "PegelstandCache" ADD COLUMN "lat" REAL;
ALTER TABLE "PegelstandCache" ADD COLUMN "lng" REAL;
