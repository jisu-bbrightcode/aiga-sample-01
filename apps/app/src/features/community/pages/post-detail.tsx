import { sessionAtom } from "@repo/core/auth";
import { TipTapViewer } from "@repo/ui/editor/tiptap-viewer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/shadcn/alert-dialog";
import { Avatar, AvatarFallback } from "@repo/ui/shadcn/avatar";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Separator } from "@repo/ui/shadcn/separator";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/shadcn/tabs";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { ReactionSection } from "@repo/widgets/reaction";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useAtomValue } from "jotai";
import {
  ArrowLeft,
  Bookmark,
  FileText,
  Flag,
  MessageSquare,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { CommentItem, type CommentWithAuthor } from "../components/comment-item";
import { KarmaBadge } from "../components/karma-badge";
import {
  useCommunityPost,
  useCreateComment,
  useDeletePost,
  usePostComments,
  useUpdatePost,
} from "../hooks";
import { type KarmaSummary, useKarma } from "../hooks/use-karma";
import { isRichContent } from "../utils/content-helpers";

interface PostDetailProps {
  slug: string;
  postId: string;
}

export function PostDetail({ slug, postId }: PostDetailProps) {
  const [commentSort, setCommentSort] = useState<"old" | "new">("old");
  const [commentText, setCommentText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const navigate = useNavigate();
  const authUser = useAtomValue(sessionAtom);
  const currentUserId = authUser?.user.id;
  const { data: post, isLoading: isLoadingPost } = useCommunityPost(postId);
  const {
    data: commentsPages,
    isLoading: isLoadingComments,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePostComments(postId, commentSort);
  const commentsData: CommentWithAuthor[] = commentsPages?.pages.flatMap((p) => p.items) ?? [];
  const createComment = useCreateComment();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();

  const allAuthorIds = [post?.authorId, ...commentsData.map((c) => c.authorId)].filter(
    Boolean,
  ) as string[];
  const { data: karmaMap } = useKarma(allAuthorIds);

  if (isLoadingPost) return <PostDetailSkeleton />;
  if (!post) return <PostNotFound slug={slug} />;

  const isAuthor = currentUserId && post.authorId === currentUserId;
  const isDeleted = post.status === "deleted" || post.status === "removed";
  const authorName =
    (post as typeof post & { authorName?: string | null }).authorName ?? "알 수 없음";
  const authorKarma = karmaMap?.get(post.authorId);

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    createComment.mutate(
      { postId: post.id, content: commentText, parentId: undefined },
      { onSuccess: () => setCommentText("") },
    );
  };

  const handleStartEdit = () => {
    setEditTitle(post.title);
    setEditContent(post.content ?? "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updatePost.mutate(
      { id: post.id, data: { title: editTitle, content: editContent } },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const handleDelete = () => {
    deletePost.mutate(post.id, {
      onSuccess: () => navigate({ to: "/c/$slug", params: { slug } }),
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Back */}
      <Link to="/c/$slug" params={{ slug }}>
        <Button variant="ghost" className="-ml-2 gap-2">
          <ArrowLeft className="size-3.5" />
          c/{slug}
        </Button>
      </Link>

      {/* Post */}
      <article className="min-w-0">
        <PostAuthorHeader authorName={authorName} slug={slug} karma={authorKarma} />

        {isEditing ? (
          <PostEditForm
            editTitle={editTitle}
            editContent={editContent}
            onTitleChange={setEditTitle}
            onContentChange={setEditContent}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditing(false)}
            isPending={updatePost.isPending}
          />
        ) : (
          <PostBody post={post} />
        )}

        {!isDeleted && (
          <>
            <PostDateLine createdAt={post.createdAt} />
            <Separator className="mb-3" />
            <PostActionsBar
              postId={post.id}
              isAuthor={Boolean(isAuthor)}
              isDeleting={deletePost.isPending}
              onEdit={handleStartEdit}
              onDelete={handleDelete}
            />
          </>
        )}
      </article>

      {/* Comment Form */}
      {!isDeleted && (
        <CommentForm
          value={commentText}
          onChange={setCommentText}
          onSubmit={handleSubmitComment}
          isPending={createComment.isPending}
        />
      )}

      {/* Comments */}
      <CommentsSection
        commentCount={post.commentCount}
        commentSort={commentSort}
        onSortChange={setCommentSort}
        isLoading={isLoadingComments}
        commentsData={commentsData}
        karmaMap={karmaMap}
        hasNextPage={Boolean(hasNextPage)}
        fetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    </div>
  );
}

function PostDetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Skeleton className="h-9 w-40" />
      <div className="flex gap-4">
        <div className="space-y-2">
          <Skeleton className="size-8 rounded" />
          <Skeleton className="mx-auto h-4 w-6" />
          <Skeleton className="size-8 rounded" />
        </div>
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2 pt-4">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>
      <div>
        <Skeleton className="mb-4 h-5 w-24" />
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </div>
  );
}

function PostNotFound({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-muted mb-4 rounded-full p-4">
        <FileText className="text-muted-foreground size-8" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">게시글을 찾을 수 없습니다</h3>
      <p className="text-muted-foreground mb-6">존재하지 않거나 삭제된 게시글입니다.</p>
      <Link to="/c/$slug" params={{ slug }}>
        <Button variant="outline">커뮤니티로 돌아가기</Button>
      </Link>
    </div>
  );
}

interface PostAuthorHeaderProps {
  authorName: string;
  slug: string;
  karma: KarmaSummary | undefined;
}

function PostAuthorHeader({ authorName, slug, karma }: PostAuthorHeaderProps) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <Avatar className="size-11">
        <AvatarFallback className="text-base font-semibold">{authorName.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-foreground text-lg font-semibold">{authorName}</span>
        <Link
          to="/c/$slug"
          params={{ slug }}
          className="text-muted-foreground hover:text-foreground text-base transition-colors"
        >
          c/{slug}
        </Link>
      </div>
      {karma && <KarmaBadge karma={karma.totalKarma} />}
    </div>
  );
}

interface PostEditFormProps {
  editTitle: string;
  editContent: string;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function PostEditForm({
  editTitle,
  editContent,
  onTitleChange,
  onContentChange,
  onSave,
  onCancel,
  isPending,
}: PostEditFormProps) {
  return (
    <div className="mb-4 space-y-3">
      <Input
        value={editTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        className="text-xl font-bold"
        placeholder="제목"
      />
      <Textarea
        value={editContent}
        onChange={(e) => onContentChange(e.target.value)}
        rows={8}
        placeholder="내용을 입력하세요..."
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={isPending}>
          {isPending ? "저장 중..." : "저장"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}

interface PostBodyProps {
  post: {
    title: string;
    type: string | null;
    content: string | null;
    linkUrl: string | null;
    mediaUrls: string[] | null;
  };
}

function PostBody({ post }: PostBodyProps) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{post.title}</h1>

      {post.type === "text" && post.content && <PostTextContent content={post.content} />}

      {post.type === "link" && post.linkUrl && (
        <a
          href={post.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary mb-4 block hover:underline"
        >
          {post.linkUrl}
        </a>
      )}

      {post.type === "image" && post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-lg border">
          <img src={post.mediaUrls[0]} alt={post.title} className="max-w-full" />
        </div>
      )}
    </>
  );
}

function PostTextContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert mb-4 max-w-none">
      {isRichContent(content) ? <RichBody content={content} /> : <PlainBody content={content} />}
    </div>
  );
}

function RichBody({ content }: { content: string }) {
  try {
    return <TipTapViewer content={JSON.parse(content)} />;
  } catch {
    return <PlainBody content={content} />;
  }
}

function PlainBody({ content }: { content: string }) {
  return <p className="whitespace-pre-wrap">{content}</p>;
}

function PostDateLine({ createdAt }: { createdAt: Date | string }) {
  const postDate = new Date(createdAt);
  const absoluteDate = format(postDate, "yyyy. M. d. · a h:mm", { locale: ko });
  const timeAgo = formatDistanceToNow(postDate, { addSuffix: true, locale: ko });
  return (
    <div className="text-muted-foreground mb-3 text-base" title={postDate.toISOString()}>
      {absoluteDate} <span className="text-muted-foreground/50">·</span> {timeAgo}
    </div>
  );
}

interface PostActionsBarProps {
  postId: string;
  isAuthor: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function PostActionsBar({ postId, isAuthor, isDeleting, onEdit, onDelete }: PostActionsBarProps) {
  return (
    <div className="-ml-2 flex items-center gap-1">
      {isAuthor && <AuthorActions isDeleting={isDeleting} onEdit={onEdit} onDelete={onDelete} />}
      <ReactionSection targetType="community_post" targetId={postId} />
      <SecondaryAction icon={<Share2 className="size-3.5" />} label="공유" />
      <SecondaryAction icon={<Bookmark className="size-3.5" />} label="저장" />
      <SecondaryAction icon={<Flag className="size-3.5" />} label="신고" />
    </div>
  );
}

function SecondaryAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-muted-foreground hover:text-foreground gap-1.5"
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}

interface AuthorActionsProps {
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function AuthorActions({ isDeleting, onEdit, onDelete }: AuthorActionsProps) {
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground gap-1.5"
        onClick={onEdit}
      >
        <Pencil className="size-3.5" />
        <span>수정</span>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive gap-1.5"
              disabled={isDeleting}
            >
              <Trash2 className="size-3.5" />
              <span>{isDeleting ? "삭제 중..." : "삭제"}</span>
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>게시글 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface CommentFormProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

function CommentForm({ value, onChange, onSubmit, isPending }: CommentFormProps) {
  return (
    <section>
      <h3 className="mb-3 text-base font-semibold">댓글 작성</h3>
      <Textarea
        placeholder="의견을 남겨보세요..."
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-3 flex justify-end">
        <Button onClick={onSubmit} disabled={!value.trim() || isPending} size="sm">
          {isPending ? "등록 중..." : "댓글 등록"}
        </Button>
      </div>
    </section>
  );
}

interface CommentsSectionProps {
  commentCount: number;
  commentSort: "old" | "new";
  onSortChange: (v: "old" | "new") => void;
  isLoading: boolean;
  commentsData: CommentWithAuthor[];
  karmaMap: Map<string, KarmaSummary> | undefined;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}

function CommentsSection({
  commentCount,
  commentSort,
  onSortChange,
  isLoading,
  commentsData,
  karmaMap,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
}: CommentsSectionProps) {
  return (
    <section>
      <div className="mb-3 flex flex-row items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-3.5" />
          댓글 {commentCount}개
        </h3>
        <Tabs value={commentSort} onValueChange={(v) => onSortChange(v as "old" | "new")}>
          <TabsList>
            <TabsTrigger value="old">오래된순</TabsTrigger>
            <TabsTrigger value="new">최신순</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Separator />
      <div className="space-y-4 pt-6">
        <CommentsList
          isLoading={isLoading}
          commentsData={commentsData}
          karmaMap={karmaMap}
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>
    </section>
  );
}

interface CommentsListProps {
  isLoading: boolean;
  commentsData: CommentWithAuthor[];
  karmaMap: Map<string, KarmaSummary> | undefined;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}

function CommentsList({
  isLoading,
  commentsData,
  karmaMap,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
}: CommentsListProps) {
  if (isLoading) return <CommentsListSkeleton />;
  if (commentsData.length === 0) return <CommentsEmpty />;
  return (
    <>
      {commentsData
        .filter((c) => !c.parentId)
        .map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            allComments={commentsData}
            karmaMap={karmaMap}
          />
        ))}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={fetchNextPage} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "불러오는 중..." : "댓글 더 보기"}
          </Button>
        </div>
      )}
    </>
  );
}

function CommentsListSkeleton() {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function CommentsEmpty() {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="bg-muted mb-3 rounded-full p-3">
        <MessageSquare className="text-muted-foreground size-5" />
      </div>
      <p className="text-muted-foreground text-base">
        아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
      </p>
    </div>
  );
}
