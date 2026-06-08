"use client";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface Props {
  userId?: number;
  benutzername?: string;
  rolle?: string;
}

/**
 * Sets Sentry user context on the client so all captured events
 * are associated with the logged-in user.
 */
export function SentryUserContext({ userId, benutzername, rolle }: Props) {
  useEffect(() => {
    if (userId) {
      Sentry.setUser({ id: String(userId), username: benutzername });
      if (rolle) Sentry.setTag("user.rolle", rolle);
    } else {
      Sentry.setUser(null);
    }
  }, [userId, benutzername, rolle]);

  return null;
}
