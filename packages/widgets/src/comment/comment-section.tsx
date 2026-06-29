/**
 * Comment Section - Connected Component
 *
 * tRPC를 통해 내부적으로 댓글 데이터를 조회/변경하는 Connected 컴포넌트.
 * 소비자는 targetType + targetId만 전달하면 됩니다.
 */
import { authenticatedAtom, profileAtom } from "@repo/core/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { MessageSquare } from "lucide-react";
import { widgetQueryKeys } from "../common/query-keys";
import { CommentForm } from "./components/comment-form";
import { CommentList } from "./components/comment-list";
import {
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "./hooks/use-comment-mutations";
import { useCommentCount, useComments } from "./hooks/use-comments";
import type { CommentTargetType } from "./types";

interface CommentSectionProps {
  targetType: CommentTargetType;
  targetId: string;
  className?: string;
  /** 카드 래퍼 없이 렌더링 */
  bare?: boolean;
  /** 제목 커스텀 */
  title?: string;
  /** 제목 숨김 */
  hideTitle?: boolean;
}

export function CommentSection({
  targetType,
  targetId,
  className,
  bare = false,
  title = "댓글",
  hideTitle = false,
}: CommentSectionProps) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAtomValue(authenticatedAtom);
  const profile = useAtomValue(profileAtom);

  const commentsQuery = useComments(targetType, targetId);
  const countQuery = useCommentCount(targetType, targetId);

  const createMutation = useCreateComment({ targetType, targetId });
  const updateMutation = useUpdateComment({ targetType, targetId });
  const deleteMutation = useDeleteComment({ targetType, targetId });

  const currentUser =
    isAuthenticated && profile
      ? { id: profile.id, name: profile.name, avatar: profile.avatar ?? null }
      : null;

  const total = countQuery.data?.count ?? 0;
  const comments = commentsQuery.data?.items ?? [];
  const hasMore = commentsQuery.data?.hasMore ?? false;

  const handleCreate = (content: string) => {
    createMutation.mutate({
      targetType,
      targetId,
      content,
    });
  };

  const handleEdit = (commentId: string, content: string) => {
    updateMutation.mutate({
      id: commentId,
      data: { content },
    });
  };

  const handleDelete = (commentId: string) => {
    deleteMutation.mutate(
      { id: commentId },
      {
        onSuccess: () => {
          // Invalidate any expanded replies as well
          queryClient.invalidateQueries({
            queryKey: widgetQueryKeys.comment.repliesPrefix(commentId),
          });
        },
      },
    );
  };

  const handleLoadMore = () => {
    // For now, refetch with higher limit could be implemented.
    // Pagination state could be added if needed.
  };

  const header = hideTitle ? null : <CommentSectionHeader title={title} total={total} />;

  const content = (
    <>
      <CommentForm
        currentUser={currentUser}
        isLoading={createMutation.isPending}
        onSubmit={handleCreate}
      />

      <div className="mt-6">
        <CommentList
          comments={comments}
          hasMore={hasMore}
          isLoading={commentsQuery.isLoading}
          error={commentsQuery.error}
          currentUser={currentUser}
          targetType={targetType}
          targetId={targetId}
          onLoadMore={hasMore ? handleLoadMore : undefined}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </>
  );

  if (bare) {
    return (
      <div className={className}>
        {header}
        {content}
      </div>
    );
  }

  return (
    <Card className={className}>
      {header ? <CardHeader>{header}</CardHeader> : null}
      <CardContent className={hideTitle ? "pt-6" : ""}>{content}</CardContent>
    </Card>
  );
}

function CommentSectionHeader({ title, total }: { title: string; total: number }) {
  return (
    <CardTitle className="mb-4 flex items-center gap-2 text-lg font-semibold">
      <MessageSquare className="h-5 w-5" />
      {title} {total > 0 ? <span className="text-muted-foreground">({total})</span> : null}
    </CardTitle>
  );
}
