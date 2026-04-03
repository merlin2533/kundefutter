-- AlterTable: Ausgabe — Add belegPfad and belegDateiname for receipt file uploads
ALTER TABLE "Ausgabe" ADD COLUMN "belegPfad"      TEXT;
ALTER TABLE "Ausgabe" ADD COLUMN "belegDateiname" TEXT;
