import { PageHeader } from "@repo/ui/components/page-header";
import { Card, CardContent } from "@repo/ui/shadcn/card";
import { Users } from "lucide-react";

export function CommunityUsersAdmin() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={<Users className="size-6" />}
        title="커뮤니티 사용자"
        description="시스템 사용자 목록 조회"
      />

      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          사용자 역할/권한 관리 기능은 현재 서버에 연결되어 있지 않아 제거되었습니다.
        </CardContent>
      </Card>
    </div>
  );
}
