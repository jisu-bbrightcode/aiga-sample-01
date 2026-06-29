import { authenticatedAtom } from "@repo/core/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Separator } from "@repo/ui/shadcn/separator";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useAtomValue } from "jotai";
import { Calendar, FileText, Globe, LogIn, Plus, Shield, Users } from "lucide-react";
import { useState } from "react";
import { PostCard } from "../components/post-card";
import { SortTabs } from "../components/sort-tabs";
import {
  useCommunity,
  useCommunityPosts,
  useJoinCommunity,
  useLeaveCommunity,
  useMyMembership,
} from "../hooks";
import type { CommunityPostListItem, CommunityPostSort } from "../hooks/useCommunityPost";

const COMMUNITY_HOME_SKELETON_KEYS = [
  "community-home-skeleton-1",
  "community-home-skeleton-2",
  "community-home-skeleton-3",
];
const POST_LIST_SKELETON_KEYS = [
  "post-list-skeleton-1",
  "post-list-skeleton-2",
  "post-list-skeleton-3",
];

interface CommunityHomeProps {
  slug: string;
}

export function CommunityHome({ slug }: CommunityHomeProps) {
  const isAuthenticated = useAtomValue(authenticatedAtom);
  const [sort, setSort] = useState<CommunityPostSort>("new");

  const { data: community, isLoading: isLoadingCommunity } = useCommunity(slug);
  const {
    data: postsData,
    isLoading: isLoadingPosts,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useCommunityPosts({ communitySlug: slug, sort, limit: 25 });

  const joinMutation = useJoinCommunity();
  const leaveMutation = useLeaveCommunity();
  const { data: membership } = useMyMembership(slug);
  const isMember = !!membership;

  if (isLoadingCommunity) return <CommunityHomeSkeleton />;
  if (!community) return <CommunityNotFound />;

  const posts = postsData?.pages.flatMap((page) => page.items) ?? [];
  const isEmpty = postsData ? postsData.pages[0]?.items.length === 0 : false;

  return (
    <div className="space-y-4">
      <CommunityHeader
        community={community}
        isAuthenticated={isAuthenticated === true}
        isMember={isMember}
        slug={slug}
        onJoin={() => joinMutation.mutate(slug)}
        onLeave={() => leaveMutation.mutate(slug)}
        isJoining={joinMutation.isPending}
        isLeaving={leaveMutation.isPending}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <SortTabs value={sort} onChange={setSort} />
          <PostsList isLoading={isLoadingPosts} posts={posts} slug={slug} />

          {isEmpty && <EmptyPosts slug={slug} isMember={isMember} />}

          {hasNextPage && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
              </Button>
            </div>
          )}
        </div>

        <aside className="hidden space-y-4 lg:block">
          {community.rules && community.rules.length > 0 ? (
            <CommunityRulesCard rules={community.rules} />
          ) : (
            <CommunityAboutCard community={community} />
          )}
        </aside>
      </div>
    </div>
  );
}

function CommunityHomeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 rounded-xl" />
      {COMMUNITY_HOME_SKELETON_KEYS.map((key) => (
        <Skeleton key={key} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

function CommunityNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-muted mb-4 rounded-full p-4">
        <Users className="text-muted-foreground size-8" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">커뮤니티를 찾을 수 없습니다</h3>
      <p className="text-muted-foreground mb-6">존재하지 않거나 삭제된 커뮤니티입니다.</p>
      <Link to="/communities">
        <Button variant="outline">커뮤니티 목록으로</Button>
      </Link>
    </div>
  );
}

interface CommunityForHeader {
  name: string;
  slug: string;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  isOfficial?: boolean | null;
  memberCount: number;
  postCount: number;
  createdAt: Date | string;
  type: string;
}

interface CommunityHeaderProps {
  community: CommunityForHeader;
  isAuthenticated: boolean;
  isMember: boolean;
  slug: string;
  onJoin: () => void;
  onLeave: () => void;
  isJoining: boolean;
  isLeaving: boolean;
}

function CommunityHeader({
  community,
  isAuthenticated,
  isMember,
  slug,
  onJoin,
  onLeave,
  isJoining,
  isLeaving,
}: CommunityHeaderProps) {
  const createdAt = formatDistanceToNow(new Date(community.createdAt), {
    addSuffix: true,
    locale: ko,
  });
  return (
    <header className="border-border border-b pb-6">
      <div className="bg-muted h-32 overflow-hidden rounded-lg">
        {community.bannerUrl ? (
          <img src={community.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="-mt-8 pt-2">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="ring-background size-16 ring-4">
            {community.iconUrl ? (
              <AvatarImage src={community.iconUrl} alt={community.name} />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {community.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <section className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{community.name}</h1>
              {community.isOfficial && (
                <Badge variant="outline" className="gap-1">
                  <Shield className="size-3.5" />
                  공식
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs">c/{community.slug}</p>
            {community.description && (
              <p className="text-muted-foreground text-base">{community.description}</p>
            )}
          </section>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <CommunityMetaLine
            memberCount={community.memberCount}
            postCount={community.postCount}
            createdAt={createdAt}
            type={community.type}
          />
          <CommunityActions
            isAuthenticated={isAuthenticated}
            isMember={isMember}
            slug={slug}
            onJoin={onJoin}
            onLeave={onLeave}
            isJoining={isJoining}
            isLeaving={isLeaving}
          />
        </div>
      </div>
    </header>
  );
}

function CommunityMetaLine({
  memberCount,
  postCount,
  createdAt,
  type,
}: {
  memberCount: number;
  postCount: number;
  createdAt: string;
  type: string;
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
      <span>멤버 {memberCount.toLocaleString()}</span>
      <span aria-hidden>•</span>
      <span>게시글 {postCount.toLocaleString()}</span>
      <span aria-hidden>•</span>
      <span className="inline-flex items-center gap-1.5">
        <Calendar className="size-3.5 shrink-0" />
        개설 {createdAt}
      </span>
      <span aria-hidden>•</span>
      <span className="inline-flex items-center gap-1.5">
        <Globe className="size-3.5 shrink-0" />
        {type === "public" ? "공개 커뮤니티" : "비공개 커뮤니티"}
      </span>
    </div>
  );
}

interface CommunityActionsProps {
  isAuthenticated: boolean;
  isMember: boolean;
  slug: string;
  onJoin: () => void;
  onLeave: () => void;
  isJoining: boolean;
  isLeaving: boolean;
}

function CommunityActions({
  isAuthenticated,
  isMember,
  slug,
  onJoin,
  onLeave,
  isJoining,
  isLeaving,
}: CommunityActionsProps) {
  if (!isAuthenticated) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link to="/sign-in">
          <Button variant="outline" size="sm" className="gap-1.5">
            <LogIn className="size-3.5" />
            로그인
          </Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2">
      {isMember ? (
        <Button variant="outline" size="sm" onClick={onLeave} disabled={isLeaving}>
          {isLeaving ? "처리 중..." : "탈퇴"}
        </Button>
      ) : (
        <Button size="sm" onClick={onJoin} disabled={isJoining}>
          {isJoining ? "처리 중..." : "가입"}
        </Button>
      )}
      {isMember && (
        <Link to="/c/$slug/submit" params={{ slug }}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            글쓰기
          </Button>
        </Link>
      )}
    </div>
  );
}

interface CommunityRule {
  title: string;
  description?: string;
}

function CommunityRulesCard({ rules }: { rules: CommunityRule[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">커뮤니티 규칙</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {rules.map((rule, index) => (
          <div key={`${rule.title}:${rule.description ?? ""}`}>
            {index > 0 && <Separator className="my-2.5" />}
            <div className="text-base">
              <div className="font-medium">
                {index + 1}. {rule.title}
              </div>
              {rule.description && (
                <div className="text-muted-foreground mt-0.5">{rule.description}</div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CommunityAboutCard({ community }: { community: CommunityForHeader }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">커뮤니티 정보</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-2 text-base">
        {community.description ? <p>{community.description}</p> : null}
        <div>멤버 {community.memberCount.toLocaleString()}</div>
        <div>게시글 {community.postCount.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function PostsList({
  isLoading,
  posts,
  slug,
}: {
  isLoading: boolean;
  posts: CommunityPostListItem[];
  slug: string;
}) {
  if (isLoading) return <PostsListSkeleton />;
  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} communitySlug={slug} />
      ))}
    </div>
  );
}

function PostsListSkeleton() {
  return (
    <div className="space-y-3">
      {POST_LIST_SKELETON_KEYS.map((key) => (
        <div key={key} className="border-border rounded-lg border p-4">
          <div className="flex gap-3">
            <Skeleton className="h-16 w-8" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex gap-3 pt-1">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyPosts({ slug, isMember }: { slug: string; isMember: boolean }) {
  return (
    <div className="border-border flex flex-col items-center rounded-lg border py-12">
      <div className="bg-muted mb-3 rounded-full p-3">
        <FileText className="text-muted-foreground size-6" />
      </div>
      <p className="text-muted-foreground mb-4">아직 게시글이 없습니다</p>
      {isMember && (
        <Link to="/c/$slug/submit" params={{ slug }}>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />첫 게시글 작성하기
          </Button>
        </Link>
      )}
    </div>
  );
}
