import { useFeatureTranslation } from "@repo/core/i18n";
import { TipTapEditor } from "@repo/ui/editor/tiptap-editor";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { Separator } from "@repo/ui/shadcn/separator";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { useCommunity } from "../hooks";
import { useCreatePost } from "../hooks";
import { extractPlainText } from "../utils/content-helpers";

interface PostSubmitFormProps {
  communitySlug: string;
}

export function PostSubmitForm({ communitySlug }: PostSubmitFormProps) {
  const { t } = useFeatureTranslation("app");
  const navigate = useNavigate();
  const { data: community } = useCommunity(communitySlug);
  const createPost = useCreatePost();

  const [formData, setFormData] = useState({
    title: "",
  });
  const [editorContent, setEditorContent] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const contentStr = editorContent ? JSON.stringify(editorContent) : "";

    const newErrors: Record<string, string> = {};
    if (formData.title.length < 1) {
      newErrors.title = t("errors.postTitleRequired");
    }
    if (!contentStr.trim() || !extractPlainText(contentStr).trim()) {
      newErrors.content = t("errors.postContentRequired");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const result = await createPost.mutateAsync({
        communityId: community!.id,
        communitySlug,
        title: formData.title,
        content: contentStr,
        type: "text",
      });
      navigate({ to: "/c/$slug/post/$postId", params: { slug: communitySlug, postId: result.id } });
    } catch (error) {
      setServerError(getAppErrorMessage(t, error, "errors.postCreate"));
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/c/$slug" params={{ slug: communitySlug }}>
        <Button variant="ghost" className="mb-6 -ml-2 gap-2">
          <ArrowLeft className="size-3.5" />
          c/{communitySlug}
        </Button>
      </Link>

      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">새 게시글</h1>
        <p className="text-muted-foreground text-base">c/{communitySlug}에 게시글을 작성합니다</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {serverError && (
          <div className="text-destructive bg-destructive/5 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-base">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="title">제목</Label>
          <Input
            id="title"
            placeholder="게시글 제목을 입력하세요"
            value={formData.title}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, title: e.target.value }));
              if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
            }}
            aria-invalid={!!errors.title}
          />
          {errors.title && <p className="text-destructive text-xs">{errors.title}</p>}
        </div>

        <div className="space-y-2">
          <Label id="content-label">내용</Label>
          <div aria-labelledby="content-label" aria-invalid={!!errors.content} role="group">
            <TipTapEditor
              onChange={(json) => {
                setEditorContent(json);
                if (errors.content) setErrors((prev) => ({ ...prev, content: "" }));
              }}
              placeholder="내용을 입력하세요..."
              toolbar="full"
              minHeight="250px"
            />
          </div>
          {errors.content && <p className="text-destructive text-xs">{errors.content}</p>}
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={createPost.isPending || !community}>
            {createPost.isPending ? "등록 중..." : "게시글 등록"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: "/c/$slug", params: { slug: communitySlug } })}
          >
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}
