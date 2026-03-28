import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "KundeFutter – Verwaltung",
  description: "Kunden-, Artikel- und Lagerverwaltung für Futter, Dünger & Saatgut",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1 p-4 md:p-6 max-w-screen-xl mx-auto w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
