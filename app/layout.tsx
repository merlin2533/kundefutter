import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import SearchPalette from "@/components/SearchPalette";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "AgrarOffice Röthemeier",
  description: "Futter · Dünger · Saatgut – Kunden-, Artikel- und Lagerverwaltung",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AgrarOffice",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#16a34a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AgrarOffice" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistration />
        <SearchPalette />
        <Nav />
        <ToastProvider>
          <main className="flex-1 p-4 md:p-6 max-w-screen-2xl mx-auto w-full">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
