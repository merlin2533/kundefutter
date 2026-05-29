"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PortalHeaderClient() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/portal/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    router.push("/portal/login");
  }

  return (
    <header className="bg-green-800 text-white shadow-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span className="font-semibold text-sm">AGRI-Office Kundenportal</span>
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm text-green-200 hover:text-white transition-colors px-3 py-1.5 rounded hover:bg-green-700"
        >
          Abmelden
        </button>
      </div>
    </header>
  );
}
