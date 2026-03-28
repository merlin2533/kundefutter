/*
  Warnings:

  - You are about to drop the `Inventur` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventurPosition` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Inventur";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InventurPosition";
PRAGMA foreign_keys=on;
