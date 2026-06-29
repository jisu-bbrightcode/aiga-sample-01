/**
 * Admin Dashboard
 */
import { profileAtom } from "@repo/core/auth";
import { useAtomValue } from "jotai";
import { Shield } from "lucide-react";
import { getLabels } from "../../lib/project";

export function AdminDashboard() {
  const profile = useAtomValue(profileAtom);
  const labels = getLabels();

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-2xl bg-muted/60 p-6">
          <Shield className="size-7 text-muted-foreground/50" />
        </div>
        <div>
          <h1 className="text-lg font-medium">{profile?.name ?? "Admin"}님, 환영합니다</h1>
          <p className="mt-1 text-sm text-muted-foreground">{labels.welcomeSubtitle}</p>
        </div>
      </div>
    </div>
  );
}
