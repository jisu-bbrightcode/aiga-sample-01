/**
 * 화면정의서의 data-el 요소 기준으로 구현.
 */

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent } from "@repo/ui/shadcn/card";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import type { ComponentProps, FormEvent, ReactNode } from "react";
import { useState } from "react";
import { authLightVars } from "@/lib/auth-surface";

export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main
      className="bg-background text-foreground relative min-h-dvh overflow-hidden [color-scheme:light]"
      data-auth-surface
      style={authLightVars}
    >
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-between overflow-y-auto px-6 py-5 sm:px-6 sm:py-8">
        <div
          className={cn(
            "flex w-full flex-1 items-center justify-center",
            wide ? "max-w-[440px]" : "max-w-[400px]",
          )}
        >
          {children}
        </div>
        <nav className="text-muted-foreground flex w-full max-w-[440px] items-center justify-center gap-2 pt-5 text-xs">
          <a className="hover:text-foreground hover:underline" href="/privacy">
            Privacy
          </a>
          <span aria-hidden="true">.</span>
          <a className="hover:text-foreground hover:underline" href="/terms">
            Terms
          </a>
          <span aria-hidden="true">.</span>
          <a className="hover:text-foreground hover:underline" href="/status">
            Status
          </a>
        </nav>
      </div>
    </main>
  );
}

export function AuthCard({
  children,
  className,
  dataEl,
}: {
  children: ReactNode;
  className?: string;
  dataEl?: string;
}) {
  return (
    <Card
      className={cn(
        "border-border-subtle bg-card w-full gap-0 rounded-[14px] py-0 shadow-[0_14px_36px_rgba(31,29,24,0.07),0_1px_2px_rgba(31,29,24,0.03)]",
        className,
      )}
      data-el={dataEl}
    >
      <CardContent className="flex flex-col gap-4 px-6 py-6 sm:px-7 sm:pt-7 sm:pb-6">
        {children}
      </CardContent>
    </Card>
  );
}

export function AuthBrand() {
  return (
    <div className="mb-0.5 inline-flex items-center gap-[9px]" data-el="auth.brand">
      <span className="text-foreground text-lg font-semibold">Product Builder</span>
    </div>
  );
}

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-foreground text-2xl leading-[1.3] font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm leading-normal">{subtitle}</p>
    </header>
  );
}

type AuthInputProps = Omit<ComponentProps<typeof Input>, "className" | "id">;

export function AuthField({
  error,
  hint,
  icon,
  id,
  label,
  rightLabel,
  ...inputProps
}: AuthInputProps & {
  error?: string | null;
  hint?: string;
  icon?: ReactNode;
  id: string;
  label: string;
  rightLabel?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-foreground text-base">
          {label}
        </Label>
        {rightLabel}
      </div>
      <div
        className={cn(
          "border-input bg-card focus-within:border-primary flex h-9 items-center gap-2 rounded-lg border px-2.5 transition-[border-color,box-shadow] focus-within:shadow-[0_0_0_2px_color-mix(in_oklch,var(--primary)_14%,transparent)] [color-scheme:light]",
          error ? "border-destructive" : null,
        )}
      >
        {icon ? (
          <span className="text-muted-foreground grid shrink-0 place-items-center">{icon}</span>
        ) : null}
        <Input
          id={id}
          aria-invalid={Boolean(error)}
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none dark:bg-transparent focus-visible:border-transparent focus-visible:ring-0 [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_var(--card)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--foreground)]"
          {...inputProps}
        />
      </div>
      {error ? <p className="text-destructive text-xs leading-snug">{error}</p> : null}
      {!error && hint ? <p className="text-muted-foreground text-xs leading-snug">{hint}</p> : null}
    </div>
  );
}

export function AuthPasswordField({
  hideLabel,
  showLabel,
  ...props
}: Omit<ComponentProps<typeof AuthField>, "type"> & {
  hideLabel: string;
  showLabel: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthField
      {...props}
      type={visible ? "text" : "password"}
      rightLabel={
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground size-6"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? hideLabel : showLabel}
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
      }
    />
  );
}

export function AuthPrimaryButton({
  children,
  className,
  loading,
  ...props
}: ComponentProps<typeof Button> & {
  loading?: boolean;
}) {
  return (
    <Button
      {...props}
      className={cn(
        "bg-primary text-primary-foreground hover:bg-primary/90 h-9 w-full gap-2 rounded-lg text-sm font-medium",
        className,
      )}
      disabled={loading || props.disabled}
    >
      {loading ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
      <span>{children}</span>
      {loading ? null : <ArrowRight className="size-3.5" />}
    </Button>
  );
}

export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs">
      <span className="bg-border-subtle h-px" />
      <span>{children}</span>
      <span className="bg-border-subtle h-px" />
    </div>
  );
}

export function AuthForm({
  children,
  dataEl,
  onSubmit,
}: {
  children: ReactNode;
  dataEl?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="flex flex-col gap-3.5" data-el={dataEl} onSubmit={onSubmit}>
      {children}
    </form>
  );
}

export function AuthFooter({ children, dataEl }: { children: ReactNode; dataEl?: string }) {
  return (
    <p className="text-muted-foreground pt-1 text-center text-base" data-el={dataEl}>
      {children}
    </p>
  );
}

export function AuthTextButton(props: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="text-primary h-auto p-0 align-baseline text-base font-medium"
      {...props}
    />
  );
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-12.6l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44a20 20 0 0 0 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 35.6 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export function NaverIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path d="M14.5 3v8.5L9.5 3H4v18h5.5v-8.5L14.5 21H20V3h-5.5z" fill="#03C75A" />
    </svg>
  );
}

export function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M12 3C6.48 3 2 6.48 2 10.77c0 2.77 1.85 5.2 4.63 6.57-.2.73-.73 2.73-.84 3.16-.13.52.19.51.4.37.17-.11 2.7-1.84 3.79-2.58.67.1 1.35.15 2.02.15 5.52 0 10-3.48 10-7.77S17.52 3 12 3z"
        fill="#000"
      />
    </svg>
  );
}

export function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
        fill="#0A66C2"
      />
    </svg>
  );
}
