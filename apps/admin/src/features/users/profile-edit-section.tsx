/**
 * Admin profile-edit section (BBR-688 / PB-ADMIN-USERS-UPDATE-001).
 *
 * Lives inside the user detail dialog. Loads the user's current profile and
 * lets an admin edit the allowed fields (표시명/핸들/소개/아바타). Email/인증수단/
 * 등급 are shown read-only so the operator can see — but cannot change — fields
 * the user manages themselves or that move through a separate flow (AC#1).
 *
 * Saving sends only changed fields plus the shared audit reason; the server
 * records the change in the admin audit log (AC#2). All failures surface a
 * friendly, non-technical toast — never raw server detail.
 */
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type AdminUserProfile,
  adminActionErrorMessage,
  fetchAdminUserProfile,
  updateAdminUserProfile,
} from "./api";
import {
  buildProfilePatch,
  isEmptyPatch,
  type ProfileFieldErrors,
  type ProfileFormValues,
  validateProfileForm,
} from "./profile-edit";

interface Props {
  userId: string;
  /** Shared audit reason from the dialog; recorded with the change. */
  reason: string;
  /** Whether another action in the dialog is in flight (disable while busy). */
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onChanged: () => void;
}

function toFormValues(profile: AdminUserProfile): ProfileFormValues {
  return {
    name: profile.name ?? "",
    handle: profile.handle ?? "",
    bio: profile.bio ?? "",
    avatar: profile.avatar ?? "",
  };
}

interface EditorState {
  profile: AdminUserProfile | null;
  values: ProfileFormValues | null;
  errors: ProfileFieldErrors;
  loadFailed: boolean;
  saving: boolean;
}

/** Owns profile load + edit/save lifecycle so the section component stays a thin view. */
function useProfileEditor({ userId, reason, onBusyChange, onChanged }: Omit<Props, "busy">) {
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [values, setValues] = useState<ProfileFormValues | null>(null);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setValues(null);
    setLoadFailed(false);
    (async () => {
      try {
        const data = await fetchAdminUserProfile(userId);
        if (cancelled) return;
        setProfile(data);
        setValues(toFormValues(data));
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function setField(field: keyof ProfileFormValues, value: string) {
    setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function onSave() {
    if (!profile || !values) return;

    const validation = validateProfileForm(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast.error("입력한 내용을 다시 확인해 주세요.");
      return;
    }

    const patch = buildProfilePatch(toFormValues(profile), values);
    if (isEmptyPatch(patch)) {
      toast.info("변경된 내용이 없습니다.");
      return;
    }

    setSaving(true);
    onBusyChange(true);
    try {
      const updated = await updateAdminUserProfile(userId, patch, reason);
      setProfile(updated);
      setValues(toFormValues(updated));
      toast.success("프로필을 수정했습니다.");
      onChanged();
    } catch (error) {
      toast.error(adminActionErrorMessage(error));
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  const state: EditorState = { profile, values, errors, loadFailed, saving };
  return { state, setField, onSave };
}

export function ProfileEditSection({ userId, reason, busy, onBusyChange, onChanged }: Props) {
  const { state, setField, onSave } = useProfileEditor({ userId, reason, onBusyChange, onChanged });
  const { profile, values, errors, loadFailed, saving } = state;

  let body: React.ReactNode;
  if (loadFailed) {
    body = (
      <p className="text-[12px] text-muted-foreground">
        프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  } else if (!values || !profile) {
    body = (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  } else {
    body = (
      <EditForm
        values={values}
        errors={errors}
        profile={profile}
        disabled={busy || saving}
        saving={saving}
        onField={setField}
        onSave={onSave}
      />
    );
  }

  return <Section title="프로필 수정">{body}</Section>;
}

function EditForm({
  values,
  errors,
  profile,
  disabled,
  saving,
  onField,
  onSave,
}: {
  values: ProfileFormValues;
  errors: ProfileFieldErrors;
  profile: AdminUserProfile;
  disabled: boolean;
  saving: boolean;
  onField: (field: keyof ProfileFormValues, value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        관리자가 대신 수정할 수 있는 프로필 항목입니다. 이메일·인증수단·등급은 사용자 본인이
        관리하거나 별도 절차로만 변경됩니다.
      </p>

      <FormField id="edit-name" label="표시명" error={errors.name}>
        <Input
          id="edit-name"
          value={values.name}
          onChange={(e) => onField("name", e.target.value)}
          maxLength={100}
          disabled={disabled}
        />
      </FormField>

      <FormField id="edit-handle" label="핸들 (선택, 비우면 해제)" error={errors.handle}>
        <Input
          id="edit-handle"
          value={values.handle}
          onChange={(e) => onField("handle", e.target.value)}
          placeholder="예: hong-gildong"
          maxLength={32}
          disabled={disabled}
        />
      </FormField>

      <FormField id="edit-bio" label="소개 (선택)" error={errors.bio}>
        <Textarea
          id="edit-bio"
          value={values.bio}
          onChange={(e) => onField("bio", e.target.value)}
          rows={2}
          maxLength={500}
          disabled={disabled}
        />
      </FormField>

      <FormField id="edit-avatar" label="아바타 이미지 URL (선택)" error={errors.avatar}>
        <Input
          id="edit-avatar"
          value={values.avatar}
          onChange={(e) => onField("avatar", e.target.value)}
          placeholder="https://..."
          maxLength={2048}
          disabled={disabled}
        />
      </FormField>

      <ReadOnlyContext profile={profile} />

      <Button size="sm" onClick={onSave} disabled={disabled}>
        {saving ? "저장 중..." : "프로필 저장"}
      </Button>
    </div>
  );
}

/** Fields the admin can see but not edit here — clarifies the AC#1 boundary. */
function ReadOnlyContext({ profile }: { profile: AdminUserProfile }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-muted/40 p-2.5 text-[12px]">
      <ReadOnlyField label="이메일 (사용자 관리)" value={profile.email} />
      <ReadOnlyField label="인증수단 (사용자 관리)" value={profile.authProvider ?? "—"} />
      <ReadOnlyField label="등급 (별도 절차)" value={profile.grade?.name ?? "—"} />
    </dl>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border p-3">
      <h3 className="text-[13px] font-medium">{title}</h3>
      {children}
    </section>
  );
}
