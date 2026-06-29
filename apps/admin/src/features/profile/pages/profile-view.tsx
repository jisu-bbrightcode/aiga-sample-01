import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Separator } from "@repo/ui/shadcn/separator";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Loader2, Pencil } from "lucide-react";
import { ProfileAvatar } from "../components/profile-avatar";
import { useProfile } from "../hooks";
import type { ProfileData } from "../types";

export function ProfileView() {
  const navigate = useNavigate();
  const { data, isLoading } = useProfile();
  const profile = data as ProfileData | undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">프로필을 불러올 수 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Profile</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/profile/edit" })}>
            <Pencil className="mr-2 size-3.5" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <ProfileAvatar src={profile.avatar} name={profile.name} size="lg" />
          <div>
            <h2 className="text-xl font-semibold">{profile.name}</h2>
            <p className="text-muted-foreground">{profile.email}</p>
          </div>
        </div>

        <Separator />

        {/* Profile Details */}
        <div className="grid gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Name</dt>
            <dd className="mt-1">{profile.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Email</dt>
            <dd className="mt-1">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Member Since</dt>
            <dd className="mt-1">
              {profile.createdAt ? format(new Date(profile.createdAt), "yyyy-MM-dd") : "-"}
            </dd>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
