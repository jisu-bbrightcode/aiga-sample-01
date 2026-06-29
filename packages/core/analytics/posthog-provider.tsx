import posthog from "posthog-js";
import { useEffect } from "react";

interface PostHogProviderProps {
  apiKey: string;
  host: string;
  children: React.ReactNode;
}

let initialized = false;

export function PostHogProvider({ apiKey, host, children }: PostHogProviderProps) {
  useEffect(() => {
    if (initialized || !apiKey) return;

    posthog.init(apiKey, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage",
      autocapture: false,
      disable_session_recording: true,
    });

    initialized = true;
  }, [apiKey, host]);

  return <>{children}</>;
}
