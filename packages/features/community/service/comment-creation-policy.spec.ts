import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { assertCommentablePost } from "./comment-creation-policy";

describe("assertCommentablePost", () => {
  it("published + 잠금 해제 게시글은 통과한다", () => {
    expect(() => assertCommentablePost({ status: "published", isLocked: false })).not.toThrow();
  });

  it("잠긴 게시글은 ForbiddenException", () => {
    expect(() => assertCommentablePost({ status: "published", isLocked: true })).toThrow(
      ForbiddenException,
    );
  });

  it("숨김(hidden) 게시글은 ForbiddenException", () => {
    expect(() => assertCommentablePost({ status: "hidden", isLocked: false })).toThrow(
      ForbiddenException,
    );
  });

  it("미공개(draft) 게시글은 ForbiddenException", () => {
    expect(() => assertCommentablePost({ status: "draft", isLocked: false })).toThrow(
      ForbiddenException,
    );
  });

  it.each(["deleted", "removed"])("%s 게시글은 NotFoundException(존재 숨김)", (status) => {
    expect(() => assertCommentablePost({ status, isLocked: false })).toThrow(NotFoundException);
  });

  it("삭제 게시글은 잠금 여부와 무관하게 NotFound가 우선한다", () => {
    expect(() => assertCommentablePost({ status: "deleted", isLocked: true })).toThrow(
      NotFoundException,
    );
  });
});
