import { Button } from "@repo/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { useCreateEmailTemplate, useUpdateEmailTemplate } from "../hooks/use-email-template-mutations";
import { parseVariableSchema, stringifyVariableSchema } from "../lib/template-variables";
import type {
  CreateTemplateInput,
  EmailTemplateDetail,
  TemplateCategory,
  UpdateTemplateInput,
} from "../templates-types";
import { TEMPLATE_CATEGORY_LABELS } from "../templates-types";

type FormMode = { mode: "create" } | { mode: "edit"; template: EmailTemplateDetail };

type EmailTemplateFormDialogProps = FormMode & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (key: string) => void;
};

const CATEGORY_OPTIONS = Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[];

const KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/** Subject + variable schema live on the working draft (highest version). */
function latestVersion(template: EmailTemplateDetail) {
  return template.versions.reduce<EmailTemplateDetail["versions"][number] | undefined>(
    (latest, version) => (!latest || version.version > latest.version ? version : latest),
    undefined,
  );
}

/**
 * 이메일 템플릿 생성/수정 폼.
 *
 * 변수 스키마는 JSON으로 입력받아 전송 전에 클라이언트에서 형식을 검증하고,
 * 서버 validation/422 오류는 폼 내부에 명확히 표시한다(AC: 실패/validation 표시).
 */
export function EmailTemplateFormDialog(props: EmailTemplateFormDialogProps) {
  const { open, onOpenChange, onSaved } = props;
  const isEdit = props.mode === "edit";
  const draft = isEdit ? latestVersion(props.template) : undefined;

  const [key, setKey] = useState(isEdit ? props.template.key : "");
  const [name, setName] = useState(isEdit ? props.template.name : "");
  const [category, setCategory] = useState<TemplateCategory>(
    isEdit ? props.template.category : "transactional",
  );
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [description, setDescription] = useState(
    isEdit ? (props.template.description ?? "") : "",
  );
  const [variableSchemaText, setVariableSchemaText] = useState(
    stringifyVariableSchema(draft?.variableSchema),
  );
  const [changelog, setChangelog] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useCreateEmailTemplate();
  const updateMutation = useUpdateEmailTemplate(isEdit ? props.template.key : "");
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async () => {
    setFormError(null);

    if (!isEdit && !KEY_PATTERN.test(key.trim())) {
      setFormError("키는 소문자/숫자와 . _ - 구분자만 사용할 수 있습니다. 예: transactional.order-confirmed");
      return;
    }
    if (name.trim() === "") {
      setFormError("템플릿 이름을 입력해 주세요.");
      return;
    }
    if (subject.trim() === "") {
      setFormError("이메일 제목을 입력해 주세요.");
      return;
    }

    const schemaResult = parseVariableSchema(variableSchemaText);
    if (!schemaResult.ok) {
      setFormError(`변수 스키마 오류 — ${schemaResult.error}`);
      return;
    }

    try {
      if (isEdit) {
        const input: UpdateTemplateInput = {
          name: name.trim(),
          category,
          description: description.trim() === "" ? null : description.trim(),
          subject: subject.trim(),
          variableSchema: schemaResult.value,
          changelog: changelog.trim() === "" ? undefined : changelog.trim(),
        };
        const saved = await updateMutation.mutateAsync(input);
        toast.success("템플릿을 수정했습니다.");
        onOpenChange(false);
        onSaved?.(saved.key);
      } else {
        const input: CreateTemplateInput = {
          key: key.trim(),
          name: name.trim(),
          category,
          subject: subject.trim(),
          ...(description.trim() === "" ? {} : { description: description.trim() }),
          ...(Object.keys(schemaResult.value).length > 0
            ? { variableSchema: schemaResult.value }
            : {}),
          ...(changelog.trim() === "" ? {} : { changelog: changelog.trim() }),
        };
        const saved = await createMutation.mutateAsync(input);
        toast.success("템플릿을 생성했습니다.");
        onOpenChange(false);
        onSaved?.(saved.key);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "저장에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "템플릿 수정" : "새 이메일 템플릿"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "수정 내용은 working draft에 저장되며, 발행 전까지 published 버전은 유지됩니다."
              : "초기 draft 버전과 함께 새 템플릿을 생성합니다. 발행은 생성 후 상세 화면에서 진행합니다."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="template-key">키</Label>
              <Input
                id="template-key"
                placeholder="transactional.order-confirmed"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                생성 후에는 변경할 수 없는 안정적 식별자입니다.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="template-name">이름</Label>
            <Input
              id="template-name"
              placeholder="주문 확인 메일"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-category">카테고리</Label>
            <Select value={category} onValueChange={(v: string | null) => v && setCategory(v as TemplateCategory)}>
              <SelectTrigger id="template-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {TEMPLATE_CATEGORY_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-subject">이메일 제목</Label>
            <Input
              id="template-subject"
              placeholder="{{name}}님, 주문이 확인되었습니다"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{`{{변수명}} 형식으로 변수를 보간할 수 있습니다.`}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">설명 (선택)</Label>
            <Textarea
              id="template-description"
              rows={2}
              placeholder="이 템플릿의 용도를 설명합니다."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-schema">변수 스키마 (JSON, 선택)</Label>
            <Textarea
              id="template-schema"
              rows={6}
              className="font-mono text-xs"
              placeholder={'{\n  "name": { "type": "string", "required": true },\n  "orderUrl": { "type": "url", "required": false }\n}'}
              value={variableSchemaText}
              onChange={(e) => setVariableSchemaText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {'각 변수는 { "type": "string|number|boolean|url", "required": true|false, "description"?: "..." } 형식입니다.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-changelog">변경 이력 (선택)</Label>
            <Textarea
              id="template-changelog"
              rows={2}
              placeholder="초기 버전 / 제목 문구 수정 등"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
            />
          </div>

          {formError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive whitespace-pre-wrap">
              {formError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "저장 중..." : isEdit ? "수정 저장" : "템플릿 생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
