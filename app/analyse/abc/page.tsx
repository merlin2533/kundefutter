import { redirect } from "next/navigation";

// Auswertung zentralisiert unter /statistik — alte URL bleibt als Weiterleitung erhalten.
export default function Page() {
  redirect("/statistik/abc");
}
