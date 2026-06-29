/**
 * Visual reference: ~/Desktop/CleanShot 2026-05-09 at 00.32.18@2x.png.
 *
 * Project content search index. Default search is intentionally name/title only;
 * property fields are opt-in from the search page popover.
 */

export type ProjectSearchResultType =
  | "world"
  | "character"
  | "location"
  | "faction"
  | "codex"
  | "draft";

export type ProjectSearchField =
  | "name"
  | "description"
  | "body"
  | "genre"
  | "age"
  | "occupation"
  | "personality"
  | "voice"
  | "region"
  | "climate"
  | "goal"
  | "influence"
  | "category";

export type ProjectSearchUpdatedRange = "any" | "day" | "week" | "month";

export interface ProjectSearchFieldOption {
  value: ProjectSearchField;
  labelKey: string;
  group: string;
}

export interface ProjectSearchResultTypeOption {
  value: ProjectSearchResultType;
  labelKey: string;
}

export interface ProjectSearchResult {
  id: string;
  resultType: ProjectSearchResultType;
  typeLabelKey: string;
  title: string;
  description: string | null;
  route: string;
  updatedAt: Date | null;
  matchedFieldLabelKey: string | null;
  properties: Array<{ labelKey: string; value: string }>;
}

export interface ProjectSearchSource {
  projectId: string;
  worlds?: unknown[];
  characters?: unknown[];
  locations?: unknown[];
  factions?: unknown[];
  codex?: unknown[];
  drafts?: unknown[];
}

export interface BuildProjectSearchResultsInput {
  source: ProjectSearchSource;
  query: string;
  fields: ProjectSearchField[];
  resultTypes: "all" | ReadonlySet<ProjectSearchResultType>;
  updatedRange: ProjectSearchUpdatedRange;
  allowEmptyQuery?: boolean;
  now?: Date;
}

interface SearchFieldValue {
  field: ProjectSearchField;
  labelKey: string;
  value: string;
}

interface SearchableItem {
  id: string;
  resultType: ProjectSearchResultType;
  typeLabelKey: string;
  title: string;
  description: string | null;
  route: string;
  updatedAt: Date | null;
  fields: SearchFieldValue[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const PROJECT_SEARCH_FALLBACK_TITLE_KEY = "search.item.fallbackTitle";

export const DEFAULT_PROJECT_SEARCH_FIELDS: ProjectSearchField[] = ["name"];

export const PROJECT_SEARCH_FIELD_OPTIONS: ProjectSearchFieldOption[] = [
  { value: "name", labelKey: "search.field.name", group: "search.fieldGroup.basic" },
  { value: "description", labelKey: "search.field.description", group: "search.fieldGroup.text" },
  { value: "body", labelKey: "search.field.body", group: "search.fieldGroup.text" },
  { value: "genre", labelKey: "search.field.genre", group: "search.fieldGroup.world" },
  { value: "age", labelKey: "search.field.age", group: "search.fieldGroup.character" },
  { value: "occupation", labelKey: "search.field.occupation", group: "search.fieldGroup.character" },
  { value: "personality", labelKey: "search.field.personality", group: "search.fieldGroup.character" },
  { value: "voice", labelKey: "search.field.voice", group: "search.fieldGroup.character" },
  { value: "region", labelKey: "search.field.region", group: "search.fieldGroup.location" },
  { value: "climate", labelKey: "search.field.climate", group: "search.fieldGroup.location" },
  { value: "goal", labelKey: "search.field.goal", group: "search.fieldGroup.faction" },
  { value: "influence", labelKey: "search.field.influence", group: "search.fieldGroup.faction" },
  { value: "category", labelKey: "search.field.category", group: "search.fieldGroup.codex" },
];

export const PROJECT_SEARCH_RESULT_TYPE_OPTIONS: ProjectSearchResultTypeOption[] = [
  { value: "world", labelKey: "search.kind.world" },
  { value: "character", labelKey: "search.kind.character" },
  { value: "location", labelKey: "search.kind.location" },
  { value: "faction", labelKey: "search.kind.faction" },
  { value: "codex", labelKey: "search.kind.codex" },
  { value: "draft", labelKey: "search.kind.draft" },
];

const FIELD_LABEL_KEYS: Record<ProjectSearchField, string> = Object.fromEntries(
  PROJECT_SEARCH_FIELD_OPTIONS.map((option) => [option.value, option.labelKey]),
) as Record<ProjectSearchField, string>;

const TYPE_LABEL_KEYS: Record<ProjectSearchResultType, string> = Object.fromEntries(
  PROJECT_SEARCH_RESULT_TYPE_OPTIONS.map((option) => [option.value, option.labelKey]),
) as Record<ProjectSearchResultType, string>;

export function buildProjectSearchResults({
  source,
  query,
  fields,
  resultTypes,
  updatedRange,
  allowEmptyQuery = false,
  now = new Date(),
}: BuildProjectSearchResultsInput): ProjectSearchResult[] {
  const enabledFields = fields.length > 0 ? fields : DEFAULT_PROJECT_SEARCH_FIELDS;
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery && !allowEmptyQuery) return [];

  return buildSearchableItems(source)
    .filter((item) => isResultTypeEnabled(resultTypes, item.resultType))
    .filter((item) => isWithinUpdatedRange(item.updatedAt, updatedRange, now))
    .map((item) => ({ item, match: findMatch(item, enabledFields, normalizedQuery) }))
    .filter(({ match }) => match.matched)
    .map(({ item, match }) => ({
      id: item.id,
      resultType: item.resultType,
      typeLabelKey: item.typeLabelKey,
      title: item.title,
      description: item.description,
      route: item.route,
      updatedAt: item.updatedAt,
      matchedFieldLabelKey: match.fieldLabelKey,
      properties: toProperties(item.fields, enabledFields),
    }))
    .sort(compareResults);
}

function buildSearchableItems(source: ProjectSearchSource): SearchableItem[] {
  const projectId = source.projectId;
  return [
    ...toDomainItems(source.worlds, "world", `/p/${projectId}/lore/worlds`, [
      "name",
      "description",
      "body",
      "genre",
    ]),
    ...toDomainItems(source.characters, "character", `/p/${projectId}/lore/characters`, [
      "name",
      "description",
      "body",
      "age",
      "occupation",
      "personality",
      "voice",
    ]),
    ...toDomainItems(source.locations, "location", `/p/${projectId}/lore/locations`, [
      "name",
      "description",
      "body",
      "region",
      "climate",
    ]),
    ...toDomainItems(source.factions, "faction", `/p/${projectId}/lore/factions`, [
      "name",
      "description",
      "body",
      "goal",
      "influence",
    ]),
    ...toDomainItems(source.codex, "codex", `/p/${projectId}/lore/codex`, [
      "name",
      "description",
      "body",
      "category",
    ]),
    ...toDomainItems(source.drafts, "draft", `/p/${projectId}/drafts`, [
      "name",
      "description",
      "body",
    ]),
  ];
}

function toDomainItems(
  rows: unknown[] | undefined,
  resultType: ProjectSearchResultType,
  routeBase: string,
  fieldKeys: ProjectSearchField[],
): SearchableItem[] {
  return (rows ?? []).map((row) => {
    const record = toRecord(row);
    const id = readString(record.id);
    const title = readTextValue(record.name) || readTextValue(record.title) || "";
    const description = readTextValue(record.description) || null;
    const fields = fieldKeys
      .map((field) => ({
        field,
        labelKey: FIELD_LABEL_KEYS[field],
        value: readFieldValue(record, field),
      }))
      .filter((field) => field.value.length > 0);

    return {
      id,
      resultType,
      typeLabelKey: TYPE_LABEL_KEYS[resultType],
      title: title,
      description,
      route: `${routeBase}/${id}`,
      updatedAt: readDate(record.updatedAt ?? record.updated_at),
      fields,
    };
  });
}

function readFieldValue(record: Record<string, unknown>, field: ProjectSearchField): string {
  if (field === "name") return readTextValue(record.name) || readTextValue(record.title);
  return readTextValue(record[field]);
}

function toProperties(
  fields: SearchFieldValue[],
  enabledFields: readonly ProjectSearchField[],
): Array<{ labelKey: string; value: string }> {
  const visibleFields = new Set(enabledFields);
  return fields
    .filter(
      (field) => field.field !== "name" && visibleFields.has(field.field) && field.value.length > 0,
    )
    .map((field) => ({ labelKey: field.labelKey, value: field.value }));
}

function findMatch(
  item: SearchableItem,
  enabledFields: ProjectSearchField[],
  normalizedQuery: string,
): { matched: boolean; fieldLabelKey: string | null } {
  if (!normalizedQuery) return { matched: true, fieldLabelKey: null };
  for (const field of enabledFields) {
    const candidate = item.fields.find((value) => value.field === field);
    if (candidate && normalizeText(candidate.value).includes(normalizedQuery)) {
      return { matched: true, fieldLabelKey: candidate.labelKey };
    }
  }
  return { matched: false, fieldLabelKey: null };
}

function isResultTypeEnabled(
  resultTypes: "all" | ReadonlySet<ProjectSearchResultType>,
  resultType: ProjectSearchResultType,
): boolean {
  return resultTypes === "all" || resultTypes.has(resultType);
}

function isWithinUpdatedRange(
  updatedAt: Date | null,
  range: ProjectSearchUpdatedRange,
  now: Date,
): boolean {
  if (range === "any") return true;
  if (!updatedAt) return false;
  const diff = now.getTime() - updatedAt.getTime();
  if (diff < 0) return true;
  if (range === "day") return diff <= DAY_MS;
  if (range === "week") return diff <= 7 * DAY_MS;
  return diff <= 30 * DAY_MS;
}

function compareResults(a: ProjectSearchResult, b: ProjectSearchResult): number {
  const aTime = a.updatedAt?.getTime() ?? 0;
  const bTime = b.updatedAt?.getTime() ?? 0;
  if (aTime !== bTime) return bTime - aTime;
  return a.title.localeCompare(b.title, "ko");
}

function readString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function readTextValue(value: unknown): string {
  const structuredText = extractStructuredText(value);
  if (structuredText) return structuredText;
  return readString(value);
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractStructuredText(value: unknown): string {
  const structured = parseStructuredValue(value);
  if (!structured) return "";

  const record = toRecord(structured);
  const lexicalRoot = toRecord(toRecord(record.lexical).root);
  const lexicalText = Object.keys(lexicalRoot).length > 0 ? walkLexicalText(lexicalRoot) : "";
  if (lexicalText) return compactText(lexicalText);

  const docText = walkDocText(record);
  return compactText(docText);
}

function parseStructuredValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function walkLexicalText(node: Record<string, unknown>): string {
  const type = typeof node.type === "string" ? node.type : "";
  if (type === "choice" || type === "choice-list") return "";
  if (type === "text" && typeof node.text === "string") return node.text;
  const children = node.children;
  if (!Array.isArray(children)) return "";
  return children
    .map((child) => walkLexicalText(toRecord(child)))
    .filter(Boolean)
    .join(" ");
}

function walkDocText(node: Record<string, unknown>): string {
  if (typeof node.text === "string") return node.text;
  const content = node.content;
  if (!Array.isArray(content)) return "";
  return content
    .map((child) => walkDocText(toRecord(child)))
    .filter(Boolean)
    .join(" ");
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
