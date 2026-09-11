import { describe, it, expect } from "vitest";
import { istPersonalSelbstbedienung, requireVollePersonalRechte } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";

function baseUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 1,
    benutzername: "test",
    name: "Test",
    email: null,
    rolle: "benutzer",
    rolleId: null,
    rolleBezeichnung: null,
    rolleBerechtigungen: [],
    berechtigungen: [],
    aktiv: true,
    mitarbeiterId: null,
    ...overrides,
  };
}

describe("istPersonalSelbstbedienung", () => {
  it("ist false ohne verknüpften Mitarbeiter", () => {
    expect(istPersonalSelbstbedienung(baseUser())).toBe(false);
  });

  it("ist true sobald mitarbeiterId gesetzt ist — unabhängig von rolle/rolleId", () => {
    expect(istPersonalSelbstbedienung(baseUser({ mitarbeiterId: 5, rolle: "admin" }))).toBe(true);
  });

  it("ist false bei fehlendem User", () => {
    expect(istPersonalSelbstbedienung(null)).toBe(false);
    expect(istPersonalSelbstbedienung(undefined)).toBe(false);
  });
});

describe("requireVollePersonalRechte", () => {
  it("liefert 401 ohne angemeldeten User", async () => {
    const res = requireVollePersonalRechte(null);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("liefert 403 für einen Selbstbedienungs-Account — auch mit rolle=admin", async () => {
    const res = requireVollePersonalRechte(baseUser({ mitarbeiterId: 5, rolle: "admin" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("liefert null (kein Deny) für einen normalen Account ohne Verknüpfung", () => {
    expect(requireVollePersonalRechte(baseUser())).toBeNull();
  });
});
