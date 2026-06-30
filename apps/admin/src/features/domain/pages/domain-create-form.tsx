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
import {
  type CreateStatus,
  doctorOperationsSchema,
  doctorPublicSchema,
  hospitalOperationsSchema,
  hospitalPublicSchema,
} from "../forms/create-schemas";
import { useCreateDomainResource } from "../hooks/use-create-domain-resource";
import { useDomainTaxonomy } from "../hooks/use-domain-taxonomy";
import type { DomainResourceType } from "../types";
import { DOMAIN_STATUS_LABELS, DOMAIN_TYPE_LABELS } from "../types";

const TYPE_OPTIONS = Object.keys(DOMAIN_TYPE_LABELS) as DomainResourceType[];
const STATUS_OPTIONS = Object.keys(DOMAIN_STATUS_LABELS) as CreateStatus[];

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

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ id, label, error, required, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

const NONE = "__none__";

/**
 * 도메인 리소스(의사/병원) 생성 폼 — PB-ADMIN-DOMAIN-CREATE-001 / BBR-680.
 *
 * 공개 정보와 운영 정보를 분리된 섹션으로 입력받고, 각 섹션을 독립된 zod 스키마로
 * 검증한다 (AC#1). 새 리소스는 기본적으로 draft 상태로 저장되며 (검수 전 저장),
 * 생성 작업은 서버에서 감사 로그에 기록된다 (AC#2).
 */
export function DomainCreateForm() {
  const navigate = useNavigate();
  const taxonomy = useDomainTaxonomy();
  const createResource = useCreateDomainResource();

  const [type, setType] = useState<DomainResourceType>("doctor");
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<CreateStatus>("draft");
  const [isFeatured, setIsFeatured] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string) => (value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const onTextInput =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key)(e.target.value);

  function buildPublic() {
    if (type === "doctor") {
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
    const shared = {
      status,
      isFeatured,
      sourceUrl: clean(values.sourceUrl ?? ""),
      internalNotes: clean(values.internalNotes ?? ""),
    };
    return type === "doctor"
      ? { ...shared, licenseNumber: clean(values.licenseNumber ?? "") }
      : { ...shared, businessRegistrationNo: clean(values.businessRegistrationNo ?? "") };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // AC#1: 공개 필드와 운영 필드를 각각 독립적으로 검증한다.
    const publicSchema = type === "doctor" ? doctorPublicSchema : hospitalPublicSchema;
    const operationsSchema = type === "doctor" ? doctorOperationsSchema : hospitalOperationsSchema;

    const publicResult = publicSchema.safeParse(buildPublic());
    const operationsResult = operationsSchema.safeParse(buildOperations());

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
    const input = { ...publicResult.data, ...operationsResult.data };

    createResource.mutate(
      type === "doctor"
        ? { type: "doctor", input: input as never }
        : { type: "hospital", input: input as never },
      {
        onSuccess: (created) => {
          toast.success("리소스가 생성되었습니다.");
          navigate({ to: "/domain/$type/$id", params: { type: created.type, id: created.id } });
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  }

  const isDoctor = type === "doctor";
  const specialties = taxonomy.data?.specialties ?? [];
  const regions = taxonomy.data?.regions ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 리소스 유형 */}
      <Card>
        <CardHeader>
          <CardTitle>리소스 유형</CardTitle>
          <CardDescription>생성할 도메인 리소스의 종류를 선택합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full md:w-[220px]">
            <Field id="resource-type" label="유형" required>
              <Select
                value={type}
                onValueChange={(v: string | null) => {
                  if (v === "doctor" || v === "hospital") {
                    setType(v);
                    setErrors({});
                  }
                }}
              >
                <SelectTrigger id="resource-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {DOMAIN_TYPE_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 공개 정보 */}
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
              value={values.regionId ?? NONE}
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
                  value={values.primarySpecialtyId ?? NONE}
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

      {/* 운영 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>운영 정보</CardTitle>
          <CardDescription>
            공개 상태·노출 등 운영자 전용 필드입니다. 민감 식별 정보는 외부에 노출되지 않습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field id="status" label="상태" error={errors.status} required>
            <Select
              value={status}
              onValueChange={(v: string | null) => {
                if (v === "draft" || v === "published" || v === "archived") {
                  setStatus(v);
                }
              }}
            >
              <SelectTrigger id="status" className="w-full md:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {DOMAIN_STATUS_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isFeatured">추천 노출</Label>
              <p className="text-sm text-muted-foreground">
                {isDoctor ? "명의 배지로 강조합니다" : "추천 병원으로 강조합니다"}
              </p>
            </div>
            <Switch id="isFeatured" checked={isFeatured} onCheckedChange={setIsFeatured} />
          </div>

          {isDoctor ? (
            <Field id="licenseNumber" label="면허번호 (내부)" error={errors.licenseNumber}>
              <Input
                id="licenseNumber"
                value={values.licenseNumber ?? ""}
                onChange={onTextInput("licenseNumber")}
              />
            </Field>
          ) : (
            <Field
              id="businessRegistrationNo"
              label="사업자등록번호 (내부)"
              error={errors.businessRegistrationNo}
            >
              <Input
                id="businessRegistrationNo"
                value={values.businessRegistrationNo ?? ""}
                onChange={onTextInput("businessRegistrationNo")}
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
        <Button type="submit" disabled={createResource.isPending}>
          {createResource.isPending ? "생성 중..." : "리소스 생성"}
        </Button>
      </div>
    </form>
  );
}
