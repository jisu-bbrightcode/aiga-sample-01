import crypto from "node:crypto";
import type { SolapiConfig } from "../config/solapi.config";

export interface SolapiMessagePayload {
  to: string;
  from: string;
  text: string;
  type?: string;
  country?: string;
  subject?: string;
  customFields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SolapiSendManyDetailInput {
  messages: SolapiMessagePayload[];
  allowDuplicates?: boolean;
  scheduledDate?: string;
  showMessageList?: boolean;
}

export interface SolapiMessageResult {
  messageId?: string;
  statusCode?: string;
  statusMessage?: string;
  customFields?: Record<string, unknown>;
  to?: string;
  [key: string]: unknown;
}

export interface SolapiSendManyDetailResponse {
  groupInfo?: {
    _id?: string;
    groupId?: string;
    count?: {
      total?: number;
      registeredSuccess?: number;
      registeredFailed?: number;
      sentSuccess?: number;
      sentTotal?: number;
      sentFailed?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  messageList?: SolapiMessageResult[];
  failedMessageList?: SolapiMessageResult[];
  [key: string]: unknown;
}

export class SolapiClientError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly providerCode?: string,
    readonly providerBody?: unknown,
  ) {
    super(message);
    this.name = "SolapiClientError";
  }
}

interface SolapiClientOptions {
  now?: () => Date;
  salt?: () => string;
  fetchImpl?: typeof fetch;
}

export class SolapiClient {
  private readonly now: () => Date;
  private readonly salt: () => string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: SolapiConfig,
    options: SolapiClientOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.salt = options.salt ?? (() => crypto.randomUUID());
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  buildAuthorizationHeader(date = this.now(), salt = this.salt()): string {
    const dateText = date.toISOString();
    const signature = crypto
      .createHmac("sha256", this.config.apiSecret)
      .update(dateText + salt)
      .digest("hex");

    return `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${dateText}, salt=${salt}, signature=${signature}`;
  }

  async sendManyDetail(input: SolapiSendManyDetailInput): Promise<SolapiSendManyDetailResponse> {
    const response = await this.fetchImpl(
      `${this.config.apiBaseUrl}/messages/v4/send-many/detail`,
      {
        method: "POST",
        headers: {
          Authorization: this.buildAuthorizationHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );

    const body = await parseJson(response);
    if (!response.ok) {
      throw new SolapiClientError(
        "SOLAPI message send failed",
        response.status,
        extractProviderCode(body),
        body,
      );
    }
    return body as SolapiSendManyDetailResponse;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractProviderCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const code = record.errorCode ?? record.code ?? record.statusCode;
  return typeof code === "string" ? code : undefined;
}
