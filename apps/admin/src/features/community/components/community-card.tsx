import type { Community } from "@repo/drizzle";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent } from "@repo/ui/shadcn/card";
import { Separator } from "@repo/ui/shadcn/separator";
import { Link } from "@tanstack/react-router";
import { FileText, Users } from "lucide-react";

interface CommunityCardProps {
  community: Community;
  onJoin?: () => void;
  isJoined?: boolean;
}

export function CommunityCard({ community, onJoin, isJoined }: CommunityCardProps) {
  return (
    <Card className="group hover:shadow-md transition-all hover:border-primary/20">
      {/* Banner area */}
      <div className="h-16 rounded-t-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />

      <CardContent className="-mt-6 space-y-3">
        {/* Avatar + Name */}
        <div className="flex items-start gap-3">
          <Avatar className="size-12 ring-2 ring-background">
            {community.iconUrl ? (
              <AvatarImage src={community.iconUrl} alt={community.name} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold text-lg">
              {community.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 pt-2">
            <Link to="/c/$slug" params={{ slug: community.slug }}>
              <h3 className="font-semibold truncate group-hover:text-primary transition-colors cursor-pointer">
                c/{community.slug}
              </h3>
            </Link>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
              {community.description}
            </p>
          </div>
        </div>

        <Separator />

        {/* Stats + Join */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              <span>{community.memberCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="size-3.5" />
              <span>{community.postCount.toLocaleString()}</span>
            </div>
          </div>

          {onJoin && (
            <Button
              size="sm"
              variant={isJoined ? "outline" : "default"}
              onClick={(e) => {
                e.preventDefault();
                onJoin();
              }}
            >
              {isJoined ? "가입됨" : "가입"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
