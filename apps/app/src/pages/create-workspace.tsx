/**
 * Create Workspace.html 3-step wizard 기준. 로고만 apps/app/public/logo.svg 사용.
 */

import type { AuthErrorLike } from "@repo/core/auth/error-codes";
import { useTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
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
import { useNavigate } from "@tanstack/react-router";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import FileText from "lucide-react/dist/esm/icons/file-text";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import Mail from "lucide-react/dist/esm/icons/mail";
import Plus from "lucide-react/dist/esm/icons/plus";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import X from "lucide-react/dist/esm/icons/x";
import { useEffect, useState } from "react";
import { useCompleteOnboarding } from "@/features/onboarding/hooks/use-onboarding";
import { useCreateProject } from "@/features/project/hooks/use-project-mutations";
import { authClient } from "../lib/auth-client";
import { getAuthErrorMessage } from "./auth/auth-error-message";
import { AuthBrand, AuthCard, AuthShell } from "./auth/auth-layout";

interface WorkspaceOrganization {
  id: string;
  name: string;
  slug?: string | null;
}

interface AuthMutationResult<T> {
  data?: T | null;
  error?: AuthErrorLike | null;
}

type InviteRole = "member" | "editor" | "admin";
type ProjectKind = "game" | "novel" | "series" | "other" | "";
type Step = 1 | 2 | 3;
type PendingAction = "workspace" | "invite" | "project" | "finish" | null;
type Translate = (key: string) => string;
type StepState = "done" | "active" | "todo";

interface InviteDraft {
  email: string;
  id: string;
  role: InviteRole;
}

type CreateWorkspaceAuthClient = typeof authClient & {
  useListOrganizations: () => {
    refetch: () => Promise<unknown>;
  };
  organization: {
    create: (input: {
      name: string;
      slug: string;
    }) => Promise<AuthMutationResult<WorkspaceOrganization>>;
    inviteMember: (input: {
      organizationId: string;
      email: string;
      role: "member" | "admin";
    }) => Promise<AuthMutationResult<unknown> | undefined>;
    setActive: (input: { organizationId: string }) => Promise<AuthMutationResult<unknown>>;
  };
};

const workspaceAuthClient = authClient as unknown as CreateWorkspaceAuthClient;
const DEFAULT_WORKSPACE_COLOR = "#1E3A5F";
const PROJECT_KIND_OPTIONS: Array<{
  id: Exclude<ProjectKind, "">;
  icon: typeof Sparkles;
  labelKey: string;
}> = [
  { id: "game", icon: Sparkles, labelKey: "createWorkspace.projectKind.game" },
  { id: "novel", icon: FileText, labelKey: "createWorkspace.projectKind.novel" },
  { id: "series", icon: FileText, labelKey: "createWorkspace.projectKind.series" },
  { id: "other", icon: Sparkles, labelKey: "createWorkspace.projectKind.other" },
];

function getSafeNextPath() {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/create-workspace")) {
    return "/";
  }
  return next;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "workspace";
}

function workspaceInitial(name: string) {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : "W";
}

function projectKindLabel(kind: ProjectKind, t: Translate) {
  const option = PROJECT_KIND_OPTIONS.find((item) => item.id === kind);
  return option ? t(option.labelKey) : undefined;
}

function apiInviteRole(role: InviteRole): "member" | "admin" {
  return role === "admin" ? "admin" : "member";
}

function canUseInviteEmail(email: string) {
  return email.trim().length > 0;
}

function createInviteDraft(): InviteDraft {
  const id = globalThis.crypto?.randomUUID?.() ?? `invite-${Date.now()}-${Math.random()}`;
  return { email: "", id, role: "member" };
}

function getStepState(number: Step, step: Step): StepState {
  if (number < step) return "done";
  if (number === step) return "active";
  return "todo";
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Design wizard keeps step orchestration and API completion callbacks together.
export function CreateWorkspacePage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const organizationsQuery = workspaceAuthClient.useListOrganizations();
  const createProject = useCreateProject();
  const completeOnboarding = useCompleteOnboarding();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [createdWorkspace, setCreatedWorkspace] = useState<WorkspaceOrganization | null>(null);
  const [invites, setInvites] = useState<InviteDraft[]>(() => [
    createInviteDraft(),
    createInviteDraft(),
  ]);
  const [linkOn, setLinkOn] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [projectKind, setProjectKind] = useState<ProjectKind>("");
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data?.user) {
      navigate({ to: "/sign-in" });
    }
  }, [navigate, sessionQuery.data?.user, sessionQuery.isPending]);

  const nextPath = getSafeNextPath();
  const canCreateWorkspace = name.trim().length >= 2 && slug.trim().length >= 2;
  const canCreateProject = projectName.trim().length >= 2;
  const isOnboardingReturn = nextPath === "/onboarding";

  const finish = () => {
    if (!isOnboardingReturn) {
      navigate({ to: nextPath });
      return;
    }
    setPending("finish");
    completeOnboarding.mutate(undefined, {
      onSuccess: () => navigate({ to: "/" }),
      onError: () => {
        setPending(null);
        setError(t("createWorkspace.finishError"));
      },
    });
  };

  const cancel = () => {
    navigate({
      to: "/workspace-select",
      search: nextPath === "/" ? undefined : { next: nextPath },
    });
  };

  const createWorkspace = async () => {
    if (!canCreateWorkspace || pending) return;
    if (createdWorkspace) {
      setStep(2);
      return;
    }
    setPending("workspace");
    setError(null);
    try {
      const result = await workspaceAuthClient.organization.create({
        name: name.trim(),
        slug: slugify(slug),
      });
      if (result.error || !result.data?.id) {
        setError(getAuthErrorMessage(t, result.error ?? null, "createWorkspace.createError"));
        return;
      }
      const activeResult = await workspaceAuthClient.organization.setActive({
        organizationId: result.data.id,
      });
      if (activeResult.error) {
        setError(getAuthErrorMessage(t, activeResult.error, "workspace.selectError"));
        return;
      }
      setCreatedWorkspace(result.data);
      await Promise.all([organizationsQuery.refetch(), sessionQuery.refetch()]);
      setStep(2);
    } catch {
      setError(t("createWorkspace.createError"));
    } finally {
      setPending(null);
    }
  };

  const sendInvites = async () => {
    const rows = invites.filter((row) => canUseInviteEmail(row.email));
    if (!createdWorkspace || pending) return;
    if (rows.length === 0) {
      setStep(3);
      return;
    }
    setPending("invite");
    setError(null);
    try {
      const results = await Promise.all(
        rows.map((row) =>
          workspaceAuthClient.organization.inviteMember({
            organizationId: createdWorkspace.id,
            email: row.email.trim(),
            role: apiInviteRole(row.role),
          }),
        ),
      );
      const failedResult = results.find((result) => result?.error);
      if (failedResult?.error) {
        setError(getAuthErrorMessage(t, failedResult.error, "createWorkspace.inviteError"));
        return;
      }
      setStep(3);
    } catch {
      setError(t("createWorkspace.inviteError"));
    } finally {
      setPending(null);
    }
  };

  const createFirstProject = () => {
    if (!canCreateProject || pending) return;
    setPending("project");
    setError(null);
    createProject.mutate(
      {
        name: projectName.trim(),
        genre: projectKindLabel(projectKind, t),
      },
      {
        onSuccess: () => finish(),
        onError: () => {
          setPending(null);
          setError(t("createWorkspace.projectError"));
        },
      },
    );
  };

  let stepContent = (
    <StepProject
      canCreate={canCreateProject}
      onBack={() => setStep(2)}
      onCreate={createFirstProject}
      onProjectKindChange={setProjectKind}
      onProjectNameChange={setProjectName}
      onSkip={finish}
      pending={pending === "project" || pending === "finish" || completeOnboarding.isPending}
      projectKind={projectKind}
      projectName={projectName}
      t={t}
      workspaceName={createdWorkspace?.name ?? name}
      workspaceSlug={createdWorkspace?.slug ?? slug}
    />
  );

  if (step === 1) {
    stepContent = (
      <StepBasics
        canContinue={canCreateWorkspace}
        name={name}
        onCancel={cancel}
        onNameChange={setName}
        onSlugChange={(value) => {
          setSlugTouched(true);
          setSlug(slugify(value));
        }}
        onSubmit={createWorkspace}
        pending={pending === "workspace"}
        slug={slug}
        t={t}
      />
    );
  } else if (step === 2) {
    stepContent = (
      <StepInvite
        invites={invites}
        linkOn={linkOn}
        onAddInvite={() => setInvites([...invites, createInviteDraft()])}
        onBack={() => setStep(1)}
        onInviteChange={(index, patch) => {
          setInvites(
            invites.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
          );
        }}
        onLinkChange={setLinkOn}
        onRemoveInvite={(index) => {
          setInvites(invites.filter((_row, rowIndex) => rowIndex !== index));
        }}
        onSkip={() => setStep(3)}
        onSubmit={sendInvites}
        pending={pending === "invite"}
        slug={createdWorkspace?.slug ?? slug}
        t={t}
      />
    );
  }

  return (
    <AuthShell wide>
      <AuthCard className="max-w-[480px]" dataEl="create-workspace.form-card">
        <WizardHeader onClose={cancel} t={t} />
        <Stepper step={step} t={t} />
        {stepContent}

        {error ? <p className="text-destructive text-base leading-snug">{error}</p> : null}
      </AuthCard>
    </AuthShell>
  );
}

function WizardHeader({ onClose, t }: { onClose: () => void; t: Translate }) {
  return (
    <div className="mb-0.5 flex items-center justify-between">
      <AuthBrand />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground size-8 rounded-lg"
        onClick={onClose}
        aria-label={t("createWorkspace.cancel")}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function Stepper({ step, t }: { step: Step; t: Translate }) {
  const labels = [
    t("createWorkspace.step.basics"),
    t("createWorkspace.step.invite"),
    step === 3 ? t("createWorkspace.step.project") : t("createWorkspace.step.done"),
  ];

  return (
    <ol className="mb-1 flex items-center gap-0" aria-label={t("createWorkspace.progress")}>
      {labels.map((label, index) => {
        const number = (index + 1) as Step;
        const state = getStepState(number, step);
        return (
          <li
            key={label}
            className={cn(
              "flex min-w-0 items-center gap-2",
              index === labels.length - 1 ? "" : "flex-1",
            )}
          >
            <span
              className={cn(
                "border-input grid size-[22px] shrink-0 place-items-center rounded-full border font-mono text-xs font-semibold transition-[background,border-color,color]",
                state === "todo"
                  ? "text-muted-foreground"
                  : "bg-primary text-primary-foreground border-primary",
              )}
            >
              {state === "done" ? <Check className="size-[11px]" /> : number}
            </span>
            <span
              className={cn(
                "text-base font-medium whitespace-nowrap max-[520px]:hidden",
                state === "active" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {index < labels.length - 1 ? (
              <span
                className={cn(
                  "mx-2 h-px min-w-3 flex-1 max-[520px]:mx-1.5",
                  state === "done" ? "bg-primary" : "bg-border",
                )}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepBasics({
  canContinue,
  name,
  onCancel,
  onNameChange,
  onSlugChange,
  onSubmit,
  pending,
  slug,
  t,
}: {
  canContinue: boolean;
  name: string;
  onCancel: () => void;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  slug: string;
  t: Translate;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <header className="space-y-1">
        <h1 className="text-foreground text-xl leading-[1.3] font-semibold">
          {t("createWorkspace.basicsTitle")}
        </h1>
        <p className="text-muted-foreground text-sm leading-normal">
          {t("createWorkspace.basicsSubtitle")}
        </p>
      </header>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workspace-name" className="text-muted-foreground text-base font-medium">
            {t("createWorkspace.workspaceName")}
          </Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t("createWorkspace.workspaceNamePlaceholder")}
            autoFocus
            className="border-input bg-card h-9 rounded-lg text-sm shadow-none focus-visible:ring-[2px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workspace-slug" className="text-muted-foreground text-base font-medium">
            {t("createWorkspace.slugLabel")}
          </Label>
          <div className="border-input bg-card focus-within:border-primary flex h-9 overflow-hidden rounded-lg border transition-[border-color,box-shadow] focus-within:shadow-[0_0_0_2px_color-mix(in_oklch,var(--primary)_14%,transparent)]">
            <span className="text-muted-foreground flex items-center pr-0 pl-3 font-mono text-base">
              product-builder.app/
            </span>
            <Input
              id="workspace-slug"
              value={slug}
              onChange={(event) => onSlugChange(event.target.value)}
              placeholder={t("createWorkspace.slugPlaceholder")}
              className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-1.5 font-mono text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <p className="text-muted-foreground text-xs leading-normal">
            {t("createWorkspace.slugHint")}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 max-[520px]:flex-col-reverse max-[520px]:items-stretch">
        <Button
          type="button"
          variant="outline"
          className="border-input bg-transparent h-9 rounded-lg px-4 text-sm"
          onClick={onCancel}
        >
          {t("createWorkspace.cancel")}
        </Button>
        <WizardPrimaryButton disabled={!canContinue} loading={pending}>
          {t("createWorkspace.continue")}
        </WizardPrimaryButton>
      </div>
    </form>
  );
}

function StepInvite({
  invites,
  linkOn,
  onAddInvite,
  onBack,
  onInviteChange,
  onLinkChange,
  onRemoveInvite,
  onSkip,
  onSubmit,
  pending,
  slug,
  t,
}: {
  invites: InviteDraft[];
  linkOn: boolean;
  onAddInvite: () => void;
  onBack: () => void;
  onInviteChange: (index: number, patch: Partial<{ email: string; role: InviteRole }>) => void;
  onLinkChange: (checked: boolean) => void;
  onRemoveInvite: (index: number) => void;
  onSkip: () => void;
  onSubmit: () => void;
  pending: boolean;
  slug: string;
  t: Translate;
}) {
  const joinLink = `product-builder.app/join/${slugify(slug)}-x7q2k`;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <header className="space-y-1">
        <h1 className="text-foreground text-xl leading-[1.3] font-semibold">
          {t("createWorkspace.inviteTitle")}
        </h1>
        <p className="text-muted-foreground text-sm leading-normal">
          {t("createWorkspace.inviteSubtitle")}
        </p>
      </header>

      <section className="flex flex-col gap-2" aria-label={t("createWorkspace.emailInvites")}>
        <h2 className="text-muted-foreground text-base font-medium">
          {t("createWorkspace.emailInvites")}
        </h2>
        <div className="flex flex-col gap-2">
          {invites.map((row, index) => (
            <InviteRow
              canRemove={invites.length > 1}
              index={index}
              key={row.id}
              onChange={(patch) => onInviteChange(index, patch)}
              onRemove={() => onRemoveInvite(index)}
              row={row}
              t={t}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground h-8 w-fit gap-2 rounded-md px-2.5 text-base font-medium"
          onClick={onAddInvite}
        >
          <Plus className="size-[13px]" />
          {t("createWorkspace.addAnother")}
        </Button>
      </section>

      <section className="border-border-subtle mt-1 flex flex-col gap-2.5 border-t pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-muted-foreground text-base font-medium">
              {t("createWorkspace.shareLinkTitle")}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-base leading-normal">
              {t("createWorkspace.shareLinkSubtitle")}
            </p>
          </div>
          <Switch
            checked={linkOn}
            onCheckedChange={onLinkChange}
            aria-label={t("createWorkspace.shareLinkTitle")}
          />
        </div>
        {linkOn ? (
          <div className="grid grid-cols-[1fr_auto] gap-2 max-[520px]:grid-cols-1">
            <Input
              readOnly
              value={joinLink}
              className="border-input bg-card h-9 rounded-lg px-3 font-mono text-base text-muted-foreground shadow-none"
              aria-label={t("createWorkspace.joinLink")}
            />
            <Button
              type="button"
              variant="outline"
              className="border-input bg-transparent h-9 gap-2 rounded-lg px-4 text-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(joinLink);
              }}
            >
              <Copy className="size-[13px]" />
              {t("createWorkspace.copyLink")}
            </Button>
          </div>
        ) : null}
      </section>

      <div className="mt-2 flex items-center justify-between gap-2 max-[520px]:flex-col-reverse max-[520px]:items-stretch">
        <Button
          type="button"
          variant="outline"
          className="border-input bg-transparent h-9 rounded-lg px-4 text-sm"
          onClick={onBack}
        >
          {t("createWorkspace.back")}
        </Button>
        <div className="flex items-center gap-2.5 max-[520px]:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-9 rounded-lg px-2 text-sm"
            onClick={onSkip}
          >
            {t("createWorkspace.skip")}
          </Button>
          <WizardPrimaryButton loading={pending}>
            {t("createWorkspace.sendInvites")}
          </WizardPrimaryButton>
        </div>
      </div>
    </form>
  );
}

function InviteRow({
  canRemove,
  index,
  onChange,
  onRemove,
  row,
  t,
}: {
  canRemove: boolean;
  index: number;
  onChange: (patch: Partial<{ email: string; role: InviteRole }>) => void;
  onRemove: () => void;
  row: { email: string; role: InviteRole };
  t: Translate;
}) {
  return (
    <div className="grid grid-cols-[1fr_116px_36px] items-center gap-2 max-[520px]:grid-cols-[1fr_100px_36px]">
      <div className="border-input bg-card focus-within:border-primary flex h-9 items-center gap-2 rounded-lg border px-2.5 transition-[border-color,box-shadow] focus-within:shadow-[0_0_0_2px_color-mix(in_oklch,var(--primary)_14%,transparent)]">
        <Mail className="text-muted-foreground size-3.5 shrink-0" />
        <Input
          value={row.email}
          onChange={(event) => onChange({ email: event.target.value })}
          placeholder={t("createWorkspace.inviteEmailPlaceholder")}
          type="email"
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          aria-label={t("createWorkspace.inviteEmail")}
        />
      </div>
      <Select value={row.role} onValueChange={(value) => onChange({ role: value as InviteRole })}>
        <SelectTrigger
          aria-label={`${t("createWorkspace.inviteRole")} ${index + 1}`}
          className="border-input bg-card h-9 w-full rounded-lg px-3 text-sm shadow-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">{t("createWorkspace.role.member")}</SelectItem>
          <SelectItem value="editor">{t("createWorkspace.role.editor")}</SelectItem>
          <SelectItem value="admin">{t("createWorkspace.role.admin")}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground size-9 rounded-lg"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={t("createWorkspace.removeInvite")}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function StepProject({
  canCreate,
  onBack,
  onCreate,
  onProjectKindChange,
  onProjectNameChange,
  onSkip,
  pending,
  projectKind,
  projectName,
  t,
  workspaceName,
  workspaceSlug,
}: {
  canCreate: boolean;
  onBack: () => void;
  onCreate: () => void;
  onProjectKindChange: (kind: ProjectKind) => void;
  onProjectNameChange: (value: string) => void;
  onSkip: () => void;
  pending: boolean;
  projectKind: ProjectKind;
  projectName: string;
  t: Translate;
  workspaceName: string;
  workspaceSlug: string;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate();
      }}
    >
      <header className="space-y-1">
        <h1 className="text-foreground text-xl leading-[1.3] font-semibold">
          {t("createWorkspace.projectTitle")}
        </h1>
        <p className="text-muted-foreground text-sm leading-normal">
          {t("createWorkspace.projectSubtitle")}
        </p>
      </header>

      <div className="border-border-subtle bg-muted flex items-center gap-3 rounded-[10px] border px-3 py-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold text-white"
          style={{ background: DEFAULT_WORKSPACE_COLOR }}
        >
          {workspaceInitial(workspaceName)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-foreground truncate text-base font-medium">{workspaceName}</span>
          <span className="text-muted-foreground truncate font-mono text-xs">
            product-builder.app/{slugify(workspaceSlug)}
          </span>
        </span>
        <span className="bg-primary text-primary-foreground grid size-[18px] shrink-0 place-items-center rounded-full">
          <Check className="size-[11px]" />
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-name" className="text-muted-foreground text-base font-medium">
            {t("createWorkspace.projectName")}
          </Label>
          <Input
            id="project-name"
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            placeholder={t("createWorkspace.projectNamePlaceholder")}
            autoFocus
            className="border-input bg-card h-9 rounded-lg text-sm shadow-none focus-visible:ring-[2px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <Label className="text-muted-foreground text-base font-medium">
              {t("createWorkspace.projectKind")}
            </Label>
            <span className="text-muted-foreground text-xs">{t("createWorkspace.optional")}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PROJECT_KIND_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = projectKind === option.id;
              return (
                <Button
                  key={option.id}
                  type="button"
                  variant="outline"
                  className={cn(
                    "border-input bg-card hover:bg-muted h-9 justify-start gap-2 rounded-lg px-3 text-left text-base font-medium shadow-none",
                    selected &&
                      "border-primary shadow-[inset_0_0_0_1px_var(--primary)] hover:bg-muted",
                  )}
                  aria-pressed={selected}
                  onClick={() => onProjectKindChange(option.id)}
                >
                  <Icon
                    className={cn("size-3.5", selected ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="truncate">{t(option.labelKey)}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 max-[520px]:flex-col-reverse max-[520px]:items-stretch">
        <Button
          type="button"
          variant="outline"
          className="border-input bg-transparent h-9 rounded-lg px-4 text-sm"
          onClick={onBack}
        >
          {t("createWorkspace.back")}
        </Button>
        <div className="flex items-center gap-2.5 max-[520px]:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-9 rounded-lg px-2 text-sm"
            onClick={onSkip}
          >
            {t("createWorkspace.skip")}
          </Button>
          <WizardPrimaryButton disabled={!canCreate} loading={pending}>
            {t("createWorkspace.createProject")}
          </WizardPrimaryButton>
        </div>
      </div>
    </form>
  );
}

function WizardPrimaryButton({
  children,
  disabled,
  loading,
}: {
  children: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      type="submit"
      className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 gap-2 rounded-lg px-4 text-sm font-medium"
      disabled={disabled || loading}
    >
      {loading ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
      <span>{children}</span>
      {loading ? null : <ArrowRight className="size-[15px]" />}
    </Button>
  );
}
