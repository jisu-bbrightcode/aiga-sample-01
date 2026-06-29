import { PostHog } from "posthog-node";
import type { PostHogConfig } from "./types";

let client: PostHog | null = null;

export function initPostHogServer(config: PostHogConfig): PostHog {
  if (client) return client;

  client = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 20,
    flushInterval: 10000,
  });

  return client;
}

export function getPostHogServer(): PostHog | null {
  return client;
}

export async function shutdownPostHogServer(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
