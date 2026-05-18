import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import PortalHeaderClient from "./_header";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();

  if (!session) {
    redirect("/portal/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeaderClient />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
