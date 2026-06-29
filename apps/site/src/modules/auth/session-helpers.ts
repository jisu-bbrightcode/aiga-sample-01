"use client";

import { sessionAtom } from "@repo/core/auth";
import { useSetAtom } from "jotai";

interface SignedInUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

/**
 * Writes a successful sign-in/up result into the shared auth atoms. The
 * `sessionAtom` setter also persists the bearer token and flips the
 * authenticated flag (see @repo/core/auth store).
 */
export function useApplySession() {
  const setSession = useSetAtom(sessionAtom);
  return (data: { token: string; user: SignedInUser }) => {
    setSession({
      token: data.token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        image: data.user.image ?? null,
        createdAt: toIso(data.user.createdAt),
        updatedAt: toIso(data.user.updatedAt),
      },
    });
  };
}
