import { Avatar, AvatarFallback } from "@repo/ui/shadcn/avatar";
import { Badge } from "@repo/ui/shadcn/badge";
import { Input } from "@repo/ui/shadcn/input";
import { Separator } from "@repo/ui/shadcn/separator";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Eye, Lock, Shield } from "lucide-react";
import { useState } from "react";

export function CommunityAdminList() {
  const [search, setSearch] = useState("");

  // TODO: Implement actual data fetching
  const communities = [
    {
      id: "1",
      name: "Programming",
      slug: "programming",
      type: "public",
      memberCount: 15420,
      postCount: 3245,
      isOfficial: true,
      createdAt: new Date("2024-01-15"),
    },
    {
      id: "2",
      name: "Gaming",
      slug: "gaming",
      type: "public",
      memberCount: 8932,
      postCount: 1876,
      isOfficial: false,
      createdAt: new Date("2024-02-20"),
    },
  ];

  const statCounts = { total: 47, public: 42, restricted: 3, private: 2 };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">커뮤니티 관리</h1>
        <p className="text-base text-muted-foreground">전체 커뮤니티 목록 및 관리</p>
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border">
          <div className="text-2xl font-bold tabular-nums">{statCounts.total}</div>
          <div className="text-xs text-muted-foreground mt-1">전체</div>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="text-2xl font-bold tabular-nums">{statCounts.public}</div>
          <div className="text-xs text-muted-foreground mt-1">공개</div>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="text-2xl font-bold tabular-nums">{statCounts.restricted}</div>
          <div className="text-xs text-muted-foreground mt-1">제한</div>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="text-2xl font-bold tabular-nums">{statCounts.private}</div>
          <div className="text-xs text-muted-foreground mt-1">비공개</div>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="커뮤니티 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Communities List */}
      <div className="space-y-1">
        {communities.map((community) => (
          <Link
            key={community.id}
            to="/c/$slug/mod"
            params={{ slug: community.slug }}
            className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-muted transition-colors group"
          >
            <Avatar size="sm">
              <AvatarFallback>{community.name.charAt(0)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-medium">c/{community.slug}</span>
                {community.isOfficial && (
                  <Badge variant="outline" className="text-2xs gap-0.5 py-0 px-1.5">
                    <Shield className="size-2.5" />
                    공식
                  </Badge>
                )}
                {community.type === "private" && (
                  <Badge variant="outline" className="text-2xs gap-0.5 py-0 px-1.5">
                    <Lock className="size-2.5" />
                    비공개
                  </Badge>
                )}
                {community.type === "restricted" && (
                  <Badge variant="outline" className="text-2xs gap-0.5 py-0 px-1.5">
                    <Eye className="size-2.5" />
                    제한
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {community.memberCount.toLocaleString()} 멤버 ·{" "}
                {community.postCount.toLocaleString()} 게시글
              </div>
            </div>

            <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
