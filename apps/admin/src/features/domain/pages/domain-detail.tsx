import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ShieldAlert, Star } from "lucide-react";
import type { ReactNode } from "react";
import { DomainStatusBadge } from "../components/domain-status-badge";
import { DomainTypeBadge } from "../components/domain-type-badge";
import type {
  DomainAffiliationRef,
  DomainDoctorDetail,
  DomainHospitalDetail,
  DomainResourceDetail,
  DomainResourceRef,
} from "../types";
import { DOMAIN_CREDENTIAL_KIND_LABELS, DOMAIN_DAY_OF_WEEK_LABELS } from "../types";

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "yyyy.MM.dd HH:mm", { locale: ko });
}

/** One label/value row in a field grid. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children ?? "-"}</dd>
    </div>
  );
}

/** Render `value` or an em dash when empty. */
function textOr(value: string | number | null | undefined): ReactNode {
  if (value === null || value === undefined || value === "") return "-";
  return value;
}

/** Link to another domain resource's detail page. */
function ResourceLink({
  resource,
  type,
}: {
  resource: DomainResourceRef | DomainAffiliationRef;
  type: "doctor" | "hospital";
}) {
  return (
    <Link
      to="/domain/$type/$id"
      params={{ type, id: resource.id }}
      className="text-primary underline-offset-2 hover:underline"
    >
      {resource.name}
    </Link>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Operational fields — shared by both resource types (운영 필드)
 * -----------------------------------------------------------------------------------------------*/

function OperationalCard({ detail }: { detail: DomainResourceDetail }) {
  const { ops } = detail;
  return (
    <Card>
      <CardHeader>
        <CardTitle>운영 상태</CardTitle>
        <CardDescription>관리자 전용 운영 필드 (공개 화면에는 노출되지 않습니다)</CardDescription>
      </CardHeader>
      <CardContent>
        <dl>
          <Field label="상태">
            <DomainStatusBadge status={detail.status} />
          </Field>
          <Field label="명의/추천">
            {detail.isFeatured ? (
              <span className="inline-flex items-center gap-1">
                <Star className="size-4 fill-yellow-400 text-yellow-400" aria-hidden /> 추천
              </span>
            ) : (
              "미추천"
            )}
          </Field>
          {detail.type === "doctor" && (
            <Field label="추천 순위">{textOr(detail.featuredRank)}</Field>
          )}
          <Field label="삭제 여부">
            {ops.isDeleted ? `삭제됨 (${formatDateTime(ops.deletedAt)})` : "활성"}
          </Field>
          <Field label="등록일">{formatDateTime(ops.createdAt)}</Field>
          <Field label="수정일">{formatDateTime(ops.updatedAt)}</Field>
          <Field label="공개일">{formatDateTime(ops.publishedAt)}</Field>
          <Field label="등록자">{textOr(ops.createdBy)}</Field>
          <Field label="수정자">{textOr(ops.updatedBy)}</Field>
          <Field label="출처 URL">
            {ops.sourceUrl ? (
              <a
                href={ops.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                {ops.sourceUrl}
              </a>
            ) : (
              "-"
            )}
          </Field>
          <Field label="내부 메모">{textOr(ops.internalNotes)}</Field>
        </dl>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Sensitive fields — masked-only (민감 정보)
 * -----------------------------------------------------------------------------------------------*/

function SensitiveCard({ detail }: { detail: DomainResourceDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-500" aria-hidden /> 민감 정보
        </CardTitle>
        <CardDescription>식별번호는 마스킹되어 끝 4자리만 표시됩니다</CardDescription>
      </CardHeader>
      <CardContent>
        <dl>
          {detail.type === "doctor" ? (
            <>
              <Field label="면허번호">
                <span className="font-mono">{textOr(detail.sensitive.licenseNumber)}</span>
              </Field>
              <Field label="면허 확인일">{formatDateTime(detail.licenseVerifiedAt)}</Field>
            </>
          ) : (
            <Field label="사업자등록번호">
              <span className="font-mono">{textOr(detail.sensitive.businessRegistrationNo)}</span>
            </Field>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Public/profile fields + related links — per type
 * -----------------------------------------------------------------------------------------------*/

function DoctorDetailBody({ detail }: { detail: DomainDoctorDetail }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>프로필</CardTitle>
          <CardDescription>공개 화면에 노출되는 의사 정보</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <Field label="직함">{textOr(detail.title)}</Field>
            <Field label="지역">{textOr(detail.region?.name)}</Field>
            <Field label="대표 진료과">{textOr(detail.primarySpecialty?.name)}</Field>
            <Field label="경력(년)">{textOr(detail.yearsExperience)}</Field>
            <Field label="평점">
              {detail.ratingAvg.toFixed(1)} ({detail.reviewCount.toLocaleString("ko-KR")}개 리뷰)
            </Field>
            <Field label="한줄 소개">{textOr(detail.shortBio)}</Field>
            <Field label="소개">{textOr(detail.biography)}</Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>관련 정보</CardTitle>
          <CardDescription>진료과 · 소속 병원 · 이력</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-medium">진료과 ({detail.specialties.length})</div>
            {detail.specialties.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {detail.specialties.map((s) => (
                  <span key={s.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                    {s.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">없음</div>
            )}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">소속 병원 ({detail.hospitals.length})</div>
            {detail.hospitals.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {detail.hospitals.map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <ResourceLink resource={h} type="hospital" />
                    {h.isPrimary && (
                      <span className="rounded bg-primary/10 px-1.5 text-xs text-primary">
                        대표
                      </span>
                    )}
                    {h.role && <span className="text-muted-foreground">· {h.role}</span>}
                    <DomainStatusBadge status={h.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">없음</div>
            )}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">이력 ({detail.credentials.length})</div>
            {detail.credentials.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {detail.credentials.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-muted px-1.5 text-xs">
                      {DOMAIN_CREDENTIAL_KIND_LABELS[c.kind] ?? c.kind}
                    </span>
                    <span>{c.title}</span>
                    {c.organization && (
                      <span className="text-muted-foreground">· {c.organization}</span>
                    )}
                    {c.displayPeriod && (
                      <span className="text-muted-foreground">({c.displayPeriod})</span>
                    )}
                    {!c.isVisible && (
                      <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-700">
                        비공개
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">없음</div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function HospitalDetailBody({ detail }: { detail: DomainHospitalDetail }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>프로필</CardTitle>
          <CardDescription>공개 화면에 노출되는 병원 정보</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <Field label="지역">{textOr(detail.region?.name)}</Field>
            <Field label="주소">{textOr(detail.addressLine)}</Field>
            <Field label="전화">{textOr(detail.phone)}</Field>
            <Field label="웹사이트">
              {detail.websiteUrl ? (
                <a
                  href={detail.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {detail.websiteUrl}
                </a>
              ) : (
                "-"
              )}
            </Field>
            <Field label="평점">
              {detail.ratingAvg.toFixed(1)} ({detail.reviewCount.toLocaleString("ko-KR")}개 리뷰)
            </Field>
            <Field label="요약">{textOr(detail.summary)}</Field>
            <Field label="설명">{textOr(detail.description)}</Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>관련 정보</CardTitle>
          <CardDescription>진료과 · 소속 의사 · 진료 시간</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-medium">진료과 ({detail.specialties.length})</div>
            {detail.specialties.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {detail.specialties.map((s) => (
                  <span key={s.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                    {s.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">없음</div>
            )}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">소속 의사 ({detail.doctors.length})</div>
            {detail.doctors.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {detail.doctors.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <ResourceLink resource={d} type="doctor" />
                    <DomainStatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">없음</div>
            )}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">진료 시간</div>
            {detail.hours.length > 0 ? (
              <ul className="space-y-0.5 text-sm">
                {detail.hours.map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <span className="w-6 text-muted-foreground">
                      {DOMAIN_DAY_OF_WEEK_LABELS[h.dayOfWeek] ?? h.dayOfWeek}
                    </span>
                    {h.isClosed ? (
                      <span className="text-muted-foreground">휴무</span>
                    ) : (
                      <span>
                        {h.opensAt ?? "-"} ~ {h.closesAt ?? "-"}
                      </span>
                    )}
                    {h.note && <span className="text-muted-foreground">· {h.note}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">없음</div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Top-level detail view
 * -----------------------------------------------------------------------------------------------*/

export function DomainDetail({ detail }: { detail: DomainResourceDetail }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{detail.name}</h1>
        <DomainTypeBadge type={detail.type} />
        <DomainStatusBadge status={detail.status} />
        <span className="text-sm text-muted-foreground">{detail.slug}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <OperationalCard detail={detail} />
        <SensitiveCard detail={detail} />
        {detail.type === "doctor" ? (
          <DoctorDetailBody detail={detail} />
        ) : (
          <HospitalDetailBody detail={detail} />
        )}
      </div>
    </div>
  );
}
