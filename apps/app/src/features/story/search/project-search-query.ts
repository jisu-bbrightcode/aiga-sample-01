const OPEN_PROPERTY_TOKEN_PATTERN = /(^|\s)@[\p{L}\p{N}_-]*$/u;

export function hasOpenPropertyToken(value: string): boolean {
  return OPEN_PROPERTY_TOKEN_PATTERN.test(value);
}

export function removeOpenPropertyToken(value: string): string {
  return value.replace(OPEN_PROPERTY_TOKEN_PATTERN, "").trimEnd();
}

export function stripSearchPropertyToken(value: string): string {
  return removeOpenPropertyToken(value).replace(/\s+/g, " ").trim();
}

export function hasExecutableProjectSearchQuery(value: string): boolean {
  return stripSearchPropertyToken(value).length > 0;
}
