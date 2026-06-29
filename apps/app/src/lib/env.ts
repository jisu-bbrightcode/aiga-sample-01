import { z } from "zod";

const clientEnvSchema = z.object({
  VITE_API_URL: z.string().optional(),
});

const raw = import.meta.env.VITE_API_URL;
export const env = clientEnvSchema.parse({
  VITE_API_URL: raw && raw.length > 0 ? raw : undefined,
});
