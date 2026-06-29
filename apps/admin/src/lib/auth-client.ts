import { initAuthClient } from "@repo/core/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3002";

export const authClient = initAuthClient(API_URL);
