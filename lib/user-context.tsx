"use client";

import { createContext, useContext } from "react";
import { hasPermission } from "@/lib/permissions";

// Serialisierbarer User-Typ für den Client (kein Server-only Code)
export type ClientUser = {
  id: number;
  benutzername: string;
  name: string;
  email: string | null;
  rolle: string;
  rolleId: number | null;
  rolleBezeichnung: string | null;
  rolleBerechtigungen: string[];
  berechtigungen: string[];
  aktiv: boolean;
};

const UserContext = createContext<ClientUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: ClientUser | null;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

/** Gibt den eingeloggten User zurück oder null. */
export function useCurrentUser(): ClientUser | null {
  return useContext(UserContext);
}

/**
 * Prüft ob der aktuelle User eine bestimmte Permission hat.
 * Gibt true zurück wenn kein User vorhanden (nicht eingeloggt) —
 * das Ausblenden von UI-Elementen ist ein UX-Feature; die echte
 * Absicherung geschieht auf der API-Ebene.
 */
export function usePermission(key: string): boolean {
  const user = useContext(UserContext);
  if (!user) return false;
  return hasPermission(user as Parameters<typeof hasPermission>[0], key);
}

/** Gibt true zurück wenn der User ALLE angegebenen Permissions hat. */
export function usePermissions(...keys: string[]): boolean {
  const user = useContext(UserContext);
  if (!user) return false;
  return keys.every((k) => hasPermission(user as Parameters<typeof hasPermission>[0], k));
}
