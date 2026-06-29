const DEFAULT_FEATUREBASE_API_URL = "https://do.featurebase.app";
const DEFAULT_FEATUREBASE_API_VERSION = "2026-01-01.nova";

export type FeedbackType = "pain" | "feature" | "bug" | "other";
export type FeaturebasePostVisibility = "public" | "authorOnly" | "companyOnly";

export interface SubmitProductFeedbackInput {
  type: FeedbackType;
  typeLabel: string;
  message: string;
  rating: number;
  path?: string;
  url?: string;
  submittedAt?: string;
  user: {
    id: string;
    email?: string;
    name?: string;
  };
}

export interface FeaturebaseFeedbackConfig {
  apiKey?: string;
  boardId?: string;
  apiUrl?: string;
  apiVersion?: string;
  tags?: string[];
  visibility?: FeaturebasePostVisibility;
  fetchImpl?: typeof fetch;
}

export type FeaturebaseFeedbackResult =
  | {
      status: "created";
      postId: string;
      postUrl?: string | null;
    }
  | {
      status: "skipped";
      reason: "not_configured";
    };

interface FeaturebaseCreatePostResponse {
  id?: unknown;
  postUrl?: unknown;
}

export function readFeaturebaseFeedbackConfig(): FeaturebaseFeedbackConfig {
  return {
    apiKey: process.env.FEATUREBASE_API_KEY,
    boardId: process.env.FEATUREBASE_FEEDBACK_BOARD_ID,
    apiUrl: process.env.FEATUREBASE_API_URL,
    apiVersion: process.env.FEATUREBASE_API_VERSION,
    tags: parseCsv(process.env.FEATUREBASE_FEEDBACK_TAGS),
    visibility: parseVisibility(process.env.FEATUREBASE_FEEDBACK_VISIBILITY),
  };
}

export async function submitFeedbackToFeaturebase(
  input: SubmitProductFeedbackInput,
  config: FeaturebaseFeedbackConfig = readFeaturebaseFeedbackConfig(),
): Promise<FeaturebaseFeedbackResult> {
  if (!config.apiKey || !config.boardId) {
    return { status: "skipped", reason: "not_configured" };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const apiUrl = trimTrailingSlash(config.apiUrl ?? DEFAULT_FEATUREBASE_API_URL);
  const apiVersion = config.apiVersion ?? DEFAULT_FEATUREBASE_API_VERSION;
  const payload = buildFeaturebasePostPayload(input, {
    boardId: config.boardId,
    tags: config.tags,
    visibility: config.visibility,
  });

  const response = await fetchImpl(`${apiUrl}/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Featurebase-Version": apiVersion,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Featurebase feedback create failed: ${response.status} ${await readError(response)}`,
    );
  }

  const data = (await response.json()) as FeaturebaseCreatePostResponse;
  const postId = typeof data.id === "string" ? data.id : "";

  return {
    status: "created",
    postId,
    postUrl: typeof data.postUrl === "string" ? data.postUrl : null,
  };
}

export function buildFeaturebasePostPayload(
  input: SubmitProductFeedbackInput,
  options: {
    boardId: string;
    tags?: string[];
    visibility?: FeaturebasePostVisibility;
  },
) {
  const title = buildTitle(input.type, input.message);
  const tags = Array.from(new Set(["product-builder-feedback", input.type, ...(options.tags ?? [])]));

  return {
    title,
    content: buildContent(input),
    boardId: options.boardId,
    tags,
    inReview: true,
    commentsEnabled: true,
    visibility: options.visibility ?? "authorOnly",
    author: {
      userId: input.user.id,
      email: input.user.email,
      name: input.user.name ?? input.user.email ?? input.user.id,
    },
  };
}

function buildTitle(type: FeedbackType, message: string) {
  const prefix: Record<FeedbackType, string> = {
    pain: "Pain point",
    feature: "Feature request",
    bug: "Bug report",
    other: "Feedback",
  };
  const firstLine = message.replace(/\s+/g, " ").trim();
  const snippet = firstLine.length > 110 ? `${firstLine.slice(0, 107)}...` : firstLine;
  return `${prefix[type]}: ${snippet}`.slice(0, 512);
}

function buildContent(input: SubmitProductFeedbackInput) {
  const rows = [
    ["Type", input.typeLabel],
    ["Rating", `${input.rating}/5`],
    ["Path", input.path],
    ["URL", input.url],
    ["Submitted at", input.submittedAt],
    ["User ID", input.user.id],
    ["User email", input.user.email],
  ].filter(([, value]) => Boolean(value));

  const metadata = rows
    .map(
      ([label, value]) =>
        `<li><strong>${escapeHtml(label ?? "")}:</strong> ${escapeHtml(value ?? "")}</li>`,
    )
    .join("");

  return [
    `<p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>`,
    metadata ? `<hr><ul>${metadata}</ul>` : "",
  ].join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseCsv(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseVisibility(value?: string): FeaturebasePostVisibility | undefined {
  if (value === "public" || value === "authorOnly" || value === "companyOnly") return value;
  return undefined;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

async function readError(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
