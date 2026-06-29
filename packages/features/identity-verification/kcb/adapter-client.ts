import {
  type KcbAdapterStandardRequest,
  type KcbAdapterStandardResponse,
  type KcbAdapterVerifyResponse,
  type KcbHealth,
  kcbAdapterStandardResponseSchema,
  kcbAdapterVerifyResponseSchema,
  kcbBlockerCodeSchema,
  kcbHealthSchema,
} from "./contracts";
import { KcbIdentityVerificationError } from "./errors";

export interface KcbAdapterClientOptions {
  baseUrl?: string;
  internalAuthToken?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class KcbAdapterClient {
  private readonly baseUrl?: string;
  private readonly internalAuthToken?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: KcbAdapterClientOptions = {}) {
    this.baseUrl = options.baseUrl?.replace(/\/+$/, "");
    this.internalAuthToken = options.internalAuthToken;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.internalAuthToken);
  }

  async health(): Promise<KcbHealth> {
    if (!this.isConfigured()) {
      return kcbHealthSchema.parse({
        ok: false,
        mode: "unset",
        adapterConfigured: false,
        officialSourceMapped: false,
        jar: { configured: false, readable: false, checksum: null },
        license: { configured: false, readable: false },
        nativeLibrary: { configured: false, readable: false },
        customModeEnabled: false,
        blockers: [
          "configuration_required",
          "official_documents_required",
          "site_code_required",
          "jar_required",
          "license_required",
          "native_library_required",
        ],
      });
    }

    const json = await this.requestJson("/health", { method: "GET" });
    return kcbHealthSchema.parse(json);
  }

  async createStandardRequest(
    input: KcbAdapterStandardRequest,
  ): Promise<KcbAdapterStandardResponse> {
    this.assertConfigured();
    const json = await this.requestJson("/internal/kcb/standard/request", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return kcbAdapterStandardResponseSchema.parse(json);
  }

  async verifyStandard(input: unknown): Promise<KcbAdapterVerifyResponse> {
    this.assertConfigured();
    const json = await this.requestJson("/internal/kcb/standard/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return kcbAdapterVerifyResponseSchema.parse(json);
  }

  async verifyCustom(input: unknown): Promise<KcbAdapterVerifyResponse> {
    this.assertConfigured();
    const json = await this.requestJson("/internal/kcb/custom/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return kcbAdapterVerifyResponseSchema.parse(json);
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new KcbIdentityVerificationError(
        "configuration_required",
        "KCB adapter base URL and internal auth token are required",
      );
    }
  }

  private async requestJson(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${this.internalAuthToken}`,
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorBody = await readJsonSafely(response);
        const code = kcbBlockerCodeSchema.safeParse(
          typeof errorBody === "object" && errorBody && "code" in errorBody
            ? errorBody.code
            : undefined,
        );
        throw new KcbIdentityVerificationError(
          code.success ? code.data : "provider_rejected",
          "KCB adapter rejected request",
        );
      }
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
