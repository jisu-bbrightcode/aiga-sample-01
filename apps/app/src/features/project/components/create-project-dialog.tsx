/**
 * Create Project Dialog — with AI Mode selection
 */

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { useCreateProject } from "../hooks/use-project-mutations";

type AiMode = "ai_powered" | "ai_safety";

interface Props {
  activeWorkspaceId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ activeWorkspaceId, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [aiMode, setAiMode] = useState<AiMode>("ai_powered");
  const createProject = useCreateProject(activeWorkspaceId);

  const isValid = name.trim().length >= 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    createProject.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        genre: genre.trim() || undefined,
        aiMode,
      },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setGenre("");
          setAiMode("ai_powered");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>새 프로젝트</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-base">
              프로젝트 이름
            </Label>
            <Input
              id="project-name"
              type="text"
              placeholder="예: 나의 첫 번째 스토리"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-genre" className="text-base">
              장르 (선택)
            </Label>
            <Input
              id="project-genre"
              type="text"
              placeholder="예: RPG, 비주얼 노벨, 인터랙티브 드라마"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base">AI 모드</Label>
            <div className="grid grid-cols-2 gap-3">
              <AiModeCard
                mode="ai_powered"
                selected={aiMode === "ai_powered"}
                onSelect={setAiMode}
              />
              <AiModeCard mode="ai_safety" selected={aiMode === "ai_safety"} onSelect={setAiMode} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-desc" className="text-base">
              설명 (선택)
            </Label>
            <Textarea
              id="project-desc"
              placeholder="프로젝트에 대한 간단한 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={!isValid || createProject.isPending}>
              {createProject.isPending ? "생성 중..." : "만들기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* Components */

const AI_MODE_CONFIG = {
  ai_powered: {
    icon: Sparkles,
    label: "AI Powered",
    description: "AI가 스토리 생성을 도와줍니다",
  },
  ai_safety: {
    icon: ShieldCheck,
    label: "AI Safety",
    description: "AI 없이 직접 창작합니다",
  },
} as const;

interface AiModeCardProps {
  mode: AiMode;
  selected: boolean;
  onSelect: (mode: AiMode) => void;
}

function AiModeCard({ mode, selected, onSelect }: AiModeCardProps) {
  const config = AI_MODE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors hover:bg-muted",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border",
      )}
      onClick={() => onSelect(mode)}
    >
      <Icon
        className={cn("size-5 shrink-0", selected ? "text-primary" : "text-muted-foreground")}
      />
      <div>
        <div className="text-base font-medium">{config.label}</div>
        <div className="text-xs text-muted-foreground">{config.description}</div>
      </div>
    </button>
  );
}
