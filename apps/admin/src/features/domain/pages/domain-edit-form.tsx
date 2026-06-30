import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Switch } from "@repo/ui/shadcn/switch";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { doctorPublicSchema, hospitalPublicSchema } from "../forms/create-schemas";
import { useDomainTaxonomy } from "../hooks/use-domain-taxonomy";
import { useUpdateDomainResource } from "../hooks/use-update-domain-resource";
import type { DomainResourceDetail } from "../types";

const NONE = "__none__";

/** Empty/whitespace → undefined so optional zod fields are skipped, not "". */
function clean(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Collapse a zod flatten() fieldErrors map to the first message per field. */
function firstErrors(fieldErrors: Record<string, string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const first = messages?.[0];
    if (first) {
      out[key] = first;
    }
  }
  return out;
}

/**
 * Operations fields editable here. status is intentionally excluded — status
 * changes flow through the dedicated 상태 변경 action so the transition is
 * validated and publishedAt is maintained (BBR-681 AC#1).
 */
const editOperationsSchema = z.object({
  featuredRank: z.number().int().min(0).optional(),
  sourceUrl: z.string().url("올바른 URL을 입력해주세요.").optional(),
  internalNotes: z.string().optional(),
  licenseNumber: z.string().max(64).optional(),
  businessRegistrationNo: z.string().max(32).optional(),
});

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

function Field({ id, label, error, required, hint, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Pre-fill the flat string value map from the resource detail. */
function initialValues(detail: DomainResourceDetail): Record<string, string> {
  const ops = detail.ops;
  const shared = {
    name: detail.name,
    slug: detail.slug,
    regionId: detail.region?.id ?? "",
    photoUrl: detail.photoUrl ?? "",
    sourceUrl: ops.sourceUrl ?? "",
    internalNotes: ops.internalNotes ?? "",
    // Sensitive identifiers arrive masked — never pre-fill them (would clobber
    // the real value). Left blank; only sent when the operator types a new one.
    licenseNumber: "",
    businessRegistrationNo: "",
  };
  if (detail.type === "doctor") {
    return {
      ...shared,
      title: detail.title ?? "",
      primarySpecialtyId: detail.primarySpecialty?.id ?? "",
      yearsExperience: detail.yearsExperience?.toString() ?? "",
      featuredRank: detail.featuredRank?.toString() ?? "",
      shortBio: detail.shortBio ?? "",
      biography: detail.biography ?? "",
    };
  }
  return {
    ...shared,
    summary: detail.summary ?? "",
    description: detail.description ?? "",
    addressLine: detail.addressLine ?? "",
    phone: detail.phone ?? "",
    websiteUrl: detail.websiteUrl ?? "",
  };
}

/**
 * 도메인 리소스(의사/병원) 수정 폼 — PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681.
 *
 * 상세에서 현재 값을 채워 넣고 공개·운영 필드를 수정한다. 공개/비공개 등 상태 변경은
 * 별도 액션에서 처리하므로 이 폼에는 없다. 민감 식별번호는 마스킹되어 채워지지 않고,
 * 새 값을 입력했을 때만 전송된다. 수정 작업은 서버에서 감사 로그에 기록된다 (AC#2).
 */
export function DomainEditForm({ detail }: { detail: DomainResourceDetail }) {
  const navigate = useNavigate();
  const taxonomy = useDomainTaxonomy();
  const update = useUpdateDomainResource();

  const isDoctor = detail.type === "doctor";
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(detail));
  const [isFeatured, setIsFeatured] = useState(detail.isFeatured);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string) => (value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const onTextInput =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key)(e.target.value);

  function buildPublic() {
    if (isDoctor) {
      const years = clean(values.yearsExperience ?? "");
      return {
        name: values.name?.trim() ?? "",
        slug: values.slug?.trim() ?? "",
        title: clean(values.title ?? ""),
        regionId: clean(values.regionId ?? ""),
        primarySpecialtyId: clean(values.primarySpecialtyId ?? ""),
        shortBio: clean(values.shortBio ?? ""),
        photoUrl: clean(values.photoUrl ?? ""),
        yearsExperience: years === undefined ? undefined : Number(years),
      };
    }
    return {
      name: values.name?.trim() ?? "",
      slug: values.slug?.trim() ?? "",
      regionId: clean(values.regionId ?? ""),
      summary: clean(values.summary ?? ""),
      addressLine: clean(values.addressLine ?? ""),
      phone: clean(values.phone ?? ""),
      websiteUrl: clean(values.websiteUrl ?? ""),
      photoUrl: clean(values.photoUrl ?? ""),
    };
  }

  function buildOperations() {
    const rank = isDoctor ? clean(values.featuredRank ?? "") : undefined;
    return {
      featuredRank: rank === undefined ? undefined : Number(rank),
      sourceUrl: clean(values.sourceUrl ?? ""),
      internalNotes: clean(values.internalNotes ?? ""),
      licenseNumber: isDoctor ? clean(values.licenseNumber ?? "") : undefined,
      businessRegistrationNo: isDoctor ? undefined : clean(values.businessRegistrationNo ?? ""),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const publicSchema = isDoctor ? doctorPublicSchema : hospitalPublicSchema;
    const publicResult = publicSchema.safeParse(buildPublic());
    const operationsResult = editOperationsSchema.safeParse(buildOperations());

    if (!publicResult.success || !operationsResult.success) {
      setErrors({
        ...(publicResult.success ? {} : firstErrors(publicResult.error.flatten().fieldErrors)),
        ...(operationsResult.success
          ? {}
          : firstErrors(operationsResult.error.flatten().fieldErrors)),
      });
      return;
    }

    setErrors({});
    // The free-text long fields (소개/설명) are not part of the public schema, so
    // merge them in explicitly.
    const longText = isDoctor
      ? { biography: clean(values.biography ?? "") }
      : { description: clean(values.description ?? "") };
    const input = { ...publicResult.data, ...operationsResult.data, ...longText, isFeatured };

    update.mutate(
      isDoctor
        ? { type: "doctor", id: detail.id, input: input as never }
        : { type: "hospital", id: detail.id, input: input as never },
      {
        onSuccess: () => {
          toast.success("리소스를 수정했습니다.");
          navigate({
            to: "/domain/$type/$id",
            params: { type: detail.type, id: detail.id },
          });
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "수정하지 못했습니다.");
        },
      },
    );
  }

  const specialties = taxonomy.data?.specialties ?? [];
  const regions = taxonomy.data?.regions ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>공개 정보</CardTitle>
          <CardDescription>공개 페이지에 노출되는 필드입니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field id="name" label={isDoctor ? "이름" : "병원명"} error={errors.name} required>
            <Input id="name" value={values.name ?? ""} onChange={onTextInput("name")} />
          </Field>
          <Field id="slug" label="slug" error={errors.slug} required>
            <Input
              id="slug"
              value={values.slug ?? ""}
              onChange={onTextInput("slug")}
              placeholder="소문자/숫자/하이픈"
            />
          </Field>

          <Field id="regionId" label="지역" error={errors.regionId}>
            <Select
              value={values.regionId ? values.regionId : NONE}
              onValueChange={(v: string | null) => set("regionId")(!v || v === NONE ? "" : v)}
            >
              <SelectTrigger id="regionId">
                <SelectValue placeholder="선택 안 함" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>선택 안 함</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {isDoctor ? (
            <>
              <Field id="title" label="직함" error={errors.title}>
                <Input id="title" value={values.title ?? ""} onChange={onTextInput("title")} />
              </Field>
              <Field id="primarySpecialtyId" label="대표 진료과" error={errors.primarySpecialtyId}>
                <Select
                  value={values.primarySpecialtyId ? values.primarySpecialtyId : NONE}
                  onValueChange={(v: string | null) =>
                    set("primarySpecialtyId")(!v || v === NONE ? "" : v)
                  }
                >
                  <SelectTrigger id="primarySpecialtyId">
                    <SelectValue placeholder="선택 안 함" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>선택 안 함</SelectItem>
                    {specialties.map((specialty) => (
                      <SelectItem key={specialty.id} value={specialty.id}>
                        {specialty.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="yearsExperience" label="경력 (년)" error={errors.yearsExperience}>
                <Input
                  id="yearsExperience"
                  type="number"
                  value={values.yearsExperience ?? ""}
                  onChange={onTextInput("yearsExperience")}
                />
              </Field>
              <Field id="shortBio" label="짧은 소개" error={errors.shortBio}>
                <Textarea
                  id="shortBio"
                  value={values.shortBio ?? ""}
                  onChange={onTextInput("shortBio")}
                />
              </Field>
              <Field id="biography" label="소개" error={errors.biography}>
                <Textarea
                  id="biography"
                  value={values.biography ?? ""}
                  onChange={onTextInput("biography")}
                />
              </Field>
            </>
          ) : (
            <>
              <Field id="summary" label="요약" error={errors.summary}>
                <Textarea
                  id="summary"
                  value={values.summary ?? ""}
                  onChange={onTextInput("summary")}
                />
              </Field>
              <Field id="description" label="설명" error={errors.description}>
                <Textarea
                  id="description"
                  value={values.description ?? ""}
                  onChange={onTextInput("description")}
                />
              </Field>
              <Field id="addressLine" label="주소" error={errors.addressLine}>
                <Input
                  id="addressLine"
                  value={values.addressLine ?? ""}
                  onChange={onTextInput("addressLine")}
                />
              </Field>
              <Field id="phone" label="전화번호" error={errors.phone}>
                <Input id="phone" value={values.phone ?? ""} onChange={onTextInput("phone")} />
              </Field>
              <Field id="websiteUrl" label="웹사이트 URL" error={errors.websiteUrl}>
                <Input
                  id="websiteUrl"
                  value={values.websiteUrl ?? ""}
                  onChange={onTextInput("websiteUrl")}
                  placeholder="https://"
                />
              </Field>
            </>
          )}

          <Field id="photoUrl" label="대표 이미지 URL" error={errors.photoUrl}>
            <Input
              id="photoUrl"
              value={values.photoUrl ?? ""}
              onChange={onTextInput("photoUrl")}
              placeholder="https://"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>운영 정보</CardTitle>
          <CardDescription>
            노출·추천·정렬 등 운영자 전용 필드입니다. 공개/비공개 상태는 상세 화면의 상태 변경에서
            바꿉니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isFeatured">추천 노출</Label>
              <p className="text-sm text-muted-foreground">
                {isDoctor ? "명의 배지로 강조합니다" : "추천 병원으로 강조합니다"}
              </p>
            </div>
            <Switch id="isFeatured" checked={isFeatured} onCheckedChange={setIsFeatured} />
          </div>

          {isDoctor && (
            <Field
              id="featuredRank"
              label="추천 정렬 순위"
              error={errors.featuredRank}
              hint="작을수록 먼저 노출됩니다 (추천 목록 정렬)"
            >
              <Input
                id="featuredRank"
                type="number"
                value={values.featuredRank ?? ""}
                onChange={onTextInput("featuredRank")}
              />
            </Field>
          )}

          {isDoctor ? (
            <Field
              id="licenseNumber"
              label="면허번호 (내부)"
              error={errors.licenseNumber}
              hint="보안을 위해 마스킹됩니다. 변경할 때만 새 값을 입력하세요"
            >
              <Input
                id="licenseNumber"
                value={values.licenseNumber ?? ""}
                onChange={onTextInput("licenseNumber")}
                placeholder="변경 시에만 입력"
              />
            </Field>
          ) : (
            <Field
              id="businessRegistrationNo"
              label="사업자등록번호 (내부)"
              error={errors.businessRegistrationNo}
              hint="보안을 위해 마스킹됩니다. 변경할 때만 새 값을 입력하세요"
            >
              <Input
                id="businessRegistrationNo"
                value={values.businessRegistrationNo ?? ""}
                onChange={onTextInput("businessRegistrationNo")}
                placeholder="변경 시에만 입력"
              />
            </Field>
          )}

          <Field id="sourceUrl" label="출처 URL (내부)" error={errors.sourceUrl}>
            <Input
              id="sourceUrl"
              value={values.sourceUrl ?? ""}
              onChange={onTextInput("sourceUrl")}
              placeholder="https://"
            />
          </Field>
          <Field id="internalNotes" label="내부 메모" error={errors.internalNotes}>
            <Textarea
              id="internalNotes"
              value={values.internalNotes ?? ""}
              onChange={onTextInput("internalNotes")}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            navigate({ to: "/domain/$type/$id", params: { type: detail.type, id: detail.id } })
          }
          disabled={update.isPending}
        >
          취소
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "저장 중..." : "변경 사항 저장"}
        </Button>
      </div>
    </form>
  );
}
