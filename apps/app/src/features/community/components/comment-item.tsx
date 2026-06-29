import type { CommunityComment } from "@repo/drizzle/schema";
import { TipTapEditor } from "@repo/ui/editor/tiptap-editor";
import { TipTapViewer } from "@repo/ui/editor/tiptap-viewer";
import { cn } from "@repo/ui/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/shadcn/alert-dialog";
import { Avatar, AvatarFallback } from "@repo/ui/shadcn/avatar";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { ReactionSection } from "@repo/widgets/reaction";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronDown, ChevronUp, Reply } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCreateComment } from "../hooks";
import type { KarmaSummary } from "../hooks/use-karma";
import { extractPlainText, isRichContent } from "../utils/content-helpers";
import { KarmaBadge } from "./karma-badge";

export type CommentWithAuthor = Omit<CommunityComment, "createdAt" | "updatedAt" | "editedAt"> & {
  createdAt: Date | string;
  updatedAt: Date | string;
  editedAt?: Date | string | null;
  authorName?: string | null;
};

interface CommentItemProps {
  comment: CommentWithAuthor;
  depth?: number;
  allComments: CommentWithAuthor[];
  karmaMap?: Map<string, KarmaSummary>;
}

export function CommentItem({ comment, depth = 0, allComments, karmaMap }: CommentItemProps) {
  const [isCollapsed, setIsCollapsed] = useState(depth >= 3);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState<Record<string, unknown> | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const createComment = useCreateComment();
  const shouldFlatten = depth >= 4;
  const karma = karmaMap?.get(comment.authorId);
  const authorName = comment.authorName ?? "알 수 없음";

  const replies = useMemo(
    () => allComments.filter((c) => c.parentId === comment.id),
    [allComments, comment.id],
  );

  const closeReplyForm = useCallback(() => {
    setShowReplyForm(false);
    setReplyContent(null);
  }, []);

  const handleSubmitReply = () => {
    const content = replyContent ? JSON.stringify(replyContent) : "";
    if (!content.trim() || !extractPlainText(content).trim()) return;

    createComment.mutate(
      { postId: comment.postId, content, parentId: comment.id },
      { onSuccess: closeReplyForm },
    );
  };

  const handleCancelReply = useCallback(() => {
    const hasReplyContent = Boolean(
      replyContent && extractPlainText(JSON.stringify(replyContent)).trim(),
    );
    if (hasReplyContent) {
      setShowCancelDialog(true);
      return;
    }
    closeReplyForm();
  }, [replyContent, closeReplyForm]);

  useEffect(() => {
    if (!showReplyForm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancelReply();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showReplyForm, handleCancelReply]);

  return (
    <motion.div
      key={comment.id}
      layout
      initial={false}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      style={{ overflow: "hidden" }}
      className={cn(
        "relative",
        depth > 0 &&
          (shouldFlatten ? "border-border border-l-2 pl-4" : "border-border ml-6 border-l-2 pl-4"),
      )}
    >
      <CommentMeta
        authorName={authorName}
        comment={comment}
        karma={karma}
        shouldFlatten={shouldFlatten}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <CommentBody comment={comment} />

            <div className="mb-3 ml-5 flex items-center gap-2">
              <ReactionSection targetType="community_comment" targetId={comment.id} />
              <Button
                size="xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground gap-1"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                <Reply className="size-3.5" />
                <span>답글</span>
              </Button>
            </div>

            <AnimatePresence initial={false}>
              {showReplyForm && (
                <ReplyFormPanel
                  prefersReducedMotion={Boolean(prefersReducedMotion)}
                  replyContent={replyContent}
                  onContentChange={setReplyContent}
                  onCancel={handleCancelReply}
                  onSubmit={handleSubmitReply}
                  isPending={createComment.isPending}
                />
              )}
            </AnimatePresence>

            <CancelReplyDialog
              open={showCancelDialog}
              onOpenChange={setShowCancelDialog}
              onConfirm={() => {
                closeReplyForm();
                setShowCancelDialog(false);
              }}
            />

            {replies.length > 0 && (
              <CommentReplies
                replies={replies}
                depth={depth}
                allComments={allComments}
                karmaMap={karmaMap}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {isCollapsed && replies.length > 0 && (
        <CollapsedRepliesToggle replyCount={replies.length} onExpand={() => setIsCollapsed(false)} />
      )}
    </motion.div>
  );
}

interface CommentMetaProps {
  authorName: string;
  comment: CommentWithAuthor;
  karma: KarmaSummary | undefined;
  shouldFlatten: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function CommentMeta({
  authorName,
  comment,
  karma,
  shouldFlatten,
  isCollapsed,
  onToggleCollapse,
}: CommentMetaProps) {
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ko });
  return (
    <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
      <button
        onClick={onToggleCollapse}
        className="hover:text-foreground focus-visible:ring-ring flex items-center gap-1.5 rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {isCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        <Avatar size="sm" className="size-5">
          <AvatarFallback className="text-2xs">{authorName.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="text-foreground font-semibold">{authorName}</span>
      </button>
      {karma && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <KarmaBadge karma={karma.totalKarma} />
        </>
      )}
      {comment.distinguished && (
        <Badge
          variant="outline"
          className="border-green-200 px-1.5 py-0 text-2xs text-green-600 dark:border-green-800"
        >
          MOD
        </Badge>
      )}
      <span className="text-muted-foreground/40">·</span>
      <span>{timeAgo}</span>
      {shouldFlatten && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground text-xs italic">↩ 답글</span>
        </>
      )}
      {comment.isEdited && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="italic">수정됨</span>
        </>
      )}
      {comment.isStickied && (
        <Badge
          variant="outline"
          className="border-green-200 px-1.5 py-0 text-2xs text-green-600 dark:border-green-800"
        >
          고정
        </Badge>
      )}
    </div>
  );
}

function CommentBody({ comment }: { comment: CommentWithAuthor }) {
  return <div className="mb-2 ml-7">{renderCommentContent(comment)}</div>;
}

function renderCommentContent(comment: CommentWithAuthor) {
  if (comment.isDeleted) {
    return <p className="text-muted-foreground text-base italic">[삭제된 댓글]</p>;
  }
  if (comment.isRemoved) {
    return <p className="text-muted-foreground text-base italic">[운영 정책에 의해 삭제됨]</p>;
  }
  if (isRichContent(comment.content)) {
    return <RichCommentBody content={comment.content} />;
  }
  return <p className="text-base leading-relaxed whitespace-pre-wrap">{comment.content}</p>;
}

function RichCommentBody({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <SafeTipTap content={content} />
    </div>
  );
}

function SafeTipTap({ content }: { content: string }) {
  try {
    return <TipTapViewer content={JSON.parse(content)} />;
  } catch {
    return <p className="text-base leading-relaxed whitespace-pre-wrap">{content}</p>;
  }
}

interface ReplyFormPanelProps {
  prefersReducedMotion: boolean;
  replyContent: Record<string, unknown> | null;
  onContentChange: (v: Record<string, unknown> | null) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
}

function ReplyFormPanel({
  prefersReducedMotion,
  replyContent,
  onContentChange,
  onCancel,
  onSubmit,
  isPending,
}: ReplyFormPanelProps) {
  const isEmpty =
    !replyContent || !extractPlainText(JSON.stringify(replyContent)).trim();
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      style={{ overflow: "hidden" }}
    >
      <div className="bg-muted/30 mb-4 ml-7 rounded-lg border p-3">
        <TipTapEditor
          placeholder="답글을 입력하세요..."
          toolbar="compact"
          minHeight="100px"
          content={replyContent ?? undefined}
          onChange={(json) => onContentChange(json)}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={isEmpty || isPending}>
            {isPending ? "등록 중..." : "답글 등록"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

interface CancelReplyDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}

function CancelReplyDialog({ open, onOpenChange, onConfirm }: CancelReplyDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>답글 작성 취소</AlertDialogTitle>
          <AlertDialogDescription>
            작성 중인 내용이 사라집니다. 계속하시겠습니까?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>확인</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CommentRepliesProps {
  replies: CommentWithAuthor[];
  depth: number;
  allComments: CommentWithAuthor[];
  karmaMap?: Map<string, KarmaSummary>;
}

function CommentReplies({ replies, depth, allComments, karmaMap }: CommentRepliesProps) {
  return (
    <div className="space-y-3">
      {replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          allComments={allComments}
          karmaMap={karmaMap}
        />
      ))}
    </div>
  );
}

function CollapsedRepliesToggle({
  replyCount,
  onExpand,
}: {
  replyCount: number;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-3 ml-7 rounded text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
      onClick={onExpand}
    >
      ▼ {replyCount}개 답글 더 보기
    </button>
  );
}
