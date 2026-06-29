import { BadRequestException } from "@nestjs/common";

export const POST_SORTS = ["hot", "new", "top", "rising", "controversial"] as const;
export type PostSort = (typeof POST_SORTS)[number];

export const DEFAULT_POST_SORT: PostSort = "new";
export const DEFAULT_POST_LIST_LIMIT = 25;
export const MAX_POST_LIST_LIMIT = 100;

const POST_SORT_SET = new Set<string>(POST_SORTS);

export function parsePostSort(value: string | undefined): PostSort {
  if (!value) return DEFAULT_POST_SORT;
  if (POST_SORT_SET.has(value)) return value as PostSort;
  throw new BadRequestException("지원하지 않는 게시글 정렬입니다.");
}

export function normalizePostListLimit(limit: number | undefined): number {
  const resolvedLimit = limit ?? DEFAULT_POST_LIST_LIMIT;

  if (!Number.isInteger(resolvedLimit) || resolvedLimit < 1) {
    throw new BadRequestException("게시글 목록 limit은 1 이상이어야 합니다.");
  }

  if (resolvedLimit > MAX_POST_LIST_LIMIT) {
    throw new BadRequestException(`게시글 목록 limit은 ${MAX_POST_LIST_LIMIT} 이하여야 합니다.`);
  }

  return resolvedLimit;
}
