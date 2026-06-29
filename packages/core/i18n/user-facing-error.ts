export type UserFacingTranslate = (key: string, options?: Record<string, unknown>) => string;

export interface UserFacingErrorMessageOptions {
  fallbackKey: string;
  codeMap?: Readonly<Record<string, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNestedRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return isRecord(value) ? value : null;
}

export function getUserFacingErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;

  const directErrorCode = readString(error.errorCode);
  if (directErrorCode) return directErrorCode;

  const directCode = readString(error.code);
  if (directCode) return directCode;

  const data = readNestedRecord(error, "data");
  const dataErrorCode = data ? readString(data.errorCode) : null;
  if (dataErrorCode) return dataErrorCode;

  const dataCode = data ? readString(data.code) : null;
  if (dataCode) return dataCode;

  const shape = readNestedRecord(error, "shape");
  const shapeData = shape ? readNestedRecord(shape, "data") : null;
  const shapeDataErrorCode = shapeData ? readString(shapeData.errorCode) : null;
  if (shapeDataErrorCode) return shapeDataErrorCode;

  return shapeData ? readString(shapeData.code) : null;
}

export function getUserFacingErrorMessage(
  t: UserFacingTranslate,
  error: unknown,
  options: UserFacingErrorMessageOptions,
) {
  const code = getUserFacingErrorCode(error);
  const mappedKey = code ? options.codeMap?.[code] : undefined;
  return t(mappedKey ?? options.fallbackKey);
}
