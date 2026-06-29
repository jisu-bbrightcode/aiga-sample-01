import { z } from "zod";

const clientEnvSchema = z.object({
  VITE_API_URL: z.string().url().optional(),
});

export const env = clientEnvSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
});
