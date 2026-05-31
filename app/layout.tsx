import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Breadcrumbs from "@/components/Breadcrumbs";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/InstallPrompt";
import SearchPalette from "@/components/SearchPalette";
import { ToastProvider } from "@/components/ToastProvider";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { getAppName } from "@/lib/appinfo";
import { getCurrentUser } from "@/lib/auth";
import { UserProvider } from "@/lib/user-context";

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  return {
    title: appName,
    description: "Kunden-, Artikel- und Lagerverwaltung für den Agrarhandel",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: appName,
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#16a34a",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [appName, currentUser] = await Promise.all([getAppName(), getCurrentUser()]);
  return (
    <html lang="de" className="h-full">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={appName} />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <UserProvider user={currentUser}>
          <ServiceWorkerRegistration />
          <InstallPrompt />
          <SearchPalette />
          <KeyboardShortcuts />
          <Nav />
          <Breadcrumbs />
          <ToastProvider>
            <main className="flex-1 p-4 md:p-6 max-w-screen-2xl mx-auto w-full">
              {children}
            </main>
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}
