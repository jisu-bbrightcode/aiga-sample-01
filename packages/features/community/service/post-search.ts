/**
 * 게시글 검색어 정규화 (PB-COMM-POST-API-LIST-001 / BBR-594).
 *
 * `GET /community/posts` 의 `search` 파라미터는 title/content 에 대한 `ILIKE`
 * 부분일치로 변환된다. 사용자 입력을 그대로 LIKE 패턴에 넣으면 `%`/`_` 가
 * 와일드카드로 해석되므로, 여기서 trim → 길이 제한 → LIKE 메타문자 이스케이프를
 * 거쳐 안전한 `%term%` 패턴을 만든다. (값은 항상 파라미터 바인딩으로 전달되어
 * SQL 인젝션과는 무관하지만, 와일드카드 오작동 방지를 위해 이스케이프한다.)
 *
 * 순수 함수 — DB 불필요, 단위 테스트로 검증한다.
 */

/** 검색어 최대 길이 (초과분은 잘라낸다). */
export const MAX_POST_SEARCH_LENGTH = 100;

/**
 * 원시 검색어를 안전한 `ILIKE` 패턴(`%term%`)으로 변환한다.
 * 비어 있거나 공백뿐이면 `null` 을 반환한다(= 검색 미적용).
 */
export function normalizePostSearchTerm(raw: string | undefined | null): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const capped = trimmed.slice(0, MAX_POST_SEARCH_LENGTH);
  // LIKE 메타문자(\ % _)를 백슬래시로 이스케이프해 리터럴로 매칭한다.
  const escaped = capped.replace(/[\\%_]/g, (char) => `\\${char}`);

  return `%${escaped}%`;
}
