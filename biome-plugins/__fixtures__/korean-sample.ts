// biome-ignore-all lint/correctness/noUnusedVariables: fixture intentionally
// declares unused identifiers — the no-hardcoded-korean Biome plugin is the
// one expected to flag the Korean literals below (currently inactive).
//
// Running `pnpm lint biome-plugins/__fixtures__/korean-sample.ts` once the
// plugin is re-enabled should flag the three Korean literals below; the
// English-only `d` baseline must stay clean.
const a = "한국어";
const b = "korean: 가나다";
const c = `${a}을(를) 저장합니다`;
const d = "hello";

export { a, b, c, d };
