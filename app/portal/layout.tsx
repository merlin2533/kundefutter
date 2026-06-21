import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import PortalHeaderClient from "./_header";

async function getPortalLinks() {
  const rows = await prisma.einstellung.findMany({
    where: { key: { in: ["firma.portal_impressum_url", "firma.datenschutz_url", "firma.name"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    impressumUrl: map["firma.portal_impressum_url"] ?? "",
    datenschutzUrl: map["firma.datenschutz_url"] ?? "",
    firmaName: map["firma.name"] ?? "",
  };
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();

  if (!session) {
    redirect("/portal/login");
  }

  const { impressumUrl, datenschutzUrl, firmaName } = await getPortalLinks();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PortalHeaderClient />
      <main className="max-w-4xl mx-auto px-4 py-6 flex-1 w-full">
        {children}
      </main>
      {(impressumUrl || datenschutzUrl) && (
        <footer className="border-t border-gray-200 bg-white mt-8">
          <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
            <span>{firmaName}</span>
            <div className="flex gap-4">
              {impressumUrl && (
                <a href={impressumUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">
                  Impressum
                </a>
              )}
              {datenschutzUrl && (
                <a href={datenschutzUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">
                  Datenschutz
                </a>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
