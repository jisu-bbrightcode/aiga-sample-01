import type {
  CloudflareApiEnvelope,
  CloudflareStreamConfig,
  NormalizedProviderError,
} from "./types";

export class CloudflareStreamApiError extends Error {
  readonly normalized: NormalizedProviderError;

  constructor(normalized: NormalizedProviderError) {
    super(normalized.message);
    this.name = "CloudflareStreamApiError";
    this.normalized = normalized;
  }
}

export class CloudflareStreamClient {
  private readonly baseUrl: string;

  constructor(
    private readonly config: CloudflareStreamConfig,
    baseUrl = "https://api.cloudflare.com/client/v4",
  ) {
    this.baseUrl = baseUrl;
  }

  accountPath(path: string): string {
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${this.baseUrl}/accounts/${this.config.accountId}${suffix}`;
  }

  async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.accountPath(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const envelope = (await response.json().catch(() => null)) as CloudflareApiEnvelope<T> | null;
    if (!response.ok || !envelope?.success) {
      throw new CloudflareStreamApiError(normalizeProviderError(response.status, envelope));
    }
    return envelope.result;
  }

  async requestRaw(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(this.accountPath(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new CloudflareStreamApiError({
        code: "CLOUDFLARE_STREAM_REQUEST_FAILED",
        message: "Cloudflare Stream request failed",
        retryable: response.status >= 500,
        status: response.status,
      });
    }
    return response;
  }
}

function normalizeProviderError(
  status: number,
  envelope: CloudflareApiEnvelope<unknown> | null,
): NormalizedProviderError {
  const first = envelope?.errors?.[0];
  return {
    code: first?.code ? `CLOUDFLARE_STREAM_${first.code}` : "CLOUDFLARE_STREAM_REQUEST_FAILED",
    message: "Cloudflare Stream request failed",
    retryable: status >= 500 || status === 429,
    status,
  };
}
