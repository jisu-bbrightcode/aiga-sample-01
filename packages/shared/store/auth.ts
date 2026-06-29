import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const TOKEN_STORAGE_KEY = "_token";

/**
 * Profile 타입 (packages/core/schema/profiles.ts와 동일)
 */
export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: "owner" | "admin" | "editor" | "guest" | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export const tokenAtom = atomWithStorage<string | null>(TOKEN_STORAGE_KEY, null);

export const authenticatedAtom = atom<boolean | null>(null);

/**
 * 현재 사용자의 Profile을 저장하는 atom
 */
export const profileAtom = atom<Profile | null>(null);

/**
 * 현재 사용자의 role을 가져오는 atom
 */
export const userRoleAtom = atom((get) => {
  const profile = get(profileAtom);
  return profile?.role ?? null;
});
