import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "AgrarOffice Röthemeier",
  description: "Futter · Dünger · Saatgut – Kunden-, Artikel- und Lagerverwaltung",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AgrarOffice",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <head>
        <meta name="theme-color" content="#166534" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1 p-4 md:p-6 max-w-screen-xl mx-auto w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
