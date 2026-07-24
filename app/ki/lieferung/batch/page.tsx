"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Alte eigenständige Batch-Route — der Batch-Modus lebt jetzt unter
 * /ki/lieferung (Modus-Umschalter), damit Einzel- und Batch-Erfassung nicht
 * mehr zwei getrennte Menüpunkte sind. Diese Seite leitet nur noch weiter,
 * damit bestehende Lesezeichen/Links weiterhin funktionieren.
 */
export default function KiLieferungBatchRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ki/lieferung?modus=batch");
  }, [router]);

  return null;
}
