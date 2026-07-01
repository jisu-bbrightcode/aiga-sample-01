import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslation } from "@repo/core/i18n";
import { Alert, AlertDescription } from "@repo/ui/shadcn/alert";
import { Button } from "@repo/ui/shadcn/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@repo/ui/shadcn/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/ui/shadcn/input-group";
import { Link, useSearch } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { useAdminSignIn } from "../hooks/use-admin-sign-in";

interface FormValues {
  email: string;
  password: string;
}

/**
 * SCR-013 Admin 로그인
 *
 * Route: /admin/login (public)
 * ACT-01: 로그인 제출 → API-001/API-002/API-003 → SCR-014
 * 상태: default / empty / loading / error / permission
 */
export function AdminSignInForm() {
  const { t } = useTranslation("auth");
  const [showPassword, setShowPassword] = useState(false);

  // permission 상태: AdminGuard가 권한 없는 계정을 /admin/login?denied=1 로 되돌린다.
  const search = useSearch({ strict: false }) as { denied?: unknown };
  const permissionDenied = search?.denied != null;

  const formSchema = useMemo(
    () =>
      z.object({
        email: z.string().email({ message: t("signInEmailInvalid") }),
        password: z.string().min(1, { message: t("signInPasswordRequired") }),
      }),
    [t],
  );

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const { execute: adminSignIn, loading, failed, reset: resetSignIn } = useAdminSignIn();

  // empty 상태: 필수 입력이 비어 유효하지 않으면 제출을 막아 default 상태와 구분한다.
  const canSubmit = form.formState.isValid && !loading;

  return (
    <section
      id="SCR-013"
      data-screen="SCR-013"
      className="flex min-h-dvh items-center justify-center bg-background px-4 py-10"
    >
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        {/* 브랜드 영역 */}
        <div className="hidden flex-col gap-6 px-4 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-7" />
            </div>
            <span className="text-2xl font-bold">Admin Console</span>
          </div>
          <h1 className="text-4xl font-bold leading-snug">{t("adminSignInBrandHeadline")}</h1>
          <p className="text-lg text-muted-foreground">{t("adminSignInBrandSubhead")}</p>
          <ul className="flex flex-col gap-3 text-muted-foreground">
            {[
              t("adminSignInBrandPoint1"),
              t("adminSignInBrandPoint2"),
              t("adminSignInBrandPoint3"),
            ].map((point) => (
              <li key={point} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* 로그인 카드 */}
        <div className="w-full rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <ShieldCheck className="size-6" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("adminSignInTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("adminSignInDescription")}</p>
          </div>

          {/* 권한 안내 (permission) */}
          {permissionDenied && (
            <Alert
              className="mb-4 border-amber-500/50 text-amber-600 dark:text-amber-500 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-500"
              data-testid="scr-013-permission"
            >
              <ShieldAlert className="size-5" />
              <AlertDescription>{t("adminSignInPermissionDenied")}</AlertDescription>
            </Alert>
          )}

          {/* 오류 안내 (error) */}
          {failed && (
            <Alert variant="destructive" className="mb-4" data-testid="scr-013-error">
              <AlertCircle className="size-5" />
              <AlertDescription>{t("adminSignInInvalidCredentials")}</AlertDescription>
            </Alert>
          )}

          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={form.handleSubmit(({ email, password }) => {
              resetSignIn();
              adminSignIn(email, password);
            })}
          >
            <FieldGroup className="flex flex-col gap-4">
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="scr-013-email">{t("signInEmailLabel")}</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (failed) resetSignIn();
                        }}
                        data-testid="scr-013-fld-01"
                        id="scr-013-email"
                        type="email"
                        required
                        autoComplete="username"
                        aria-invalid={fieldState.invalid}
                        placeholder="admin@example.com"
                      />
                    </InputGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="scr-013-password">{t("signInPasswordLabel")}</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (failed) resetSignIn();
                        }}
                        data-testid="scr-013-fld-02"
                        id="scr-013-password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        aria-invalid={fieldState.invalid}
                        placeholder="••••••••"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          size="icon-xs"
                          aria-label={
                            showPassword
                              ? t("adminSignInHidePassword")
                              : t("adminSignInShowPassword")
                          }
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>

            <Button
              data-testid="scr-013-fld-03"
              data-act="ACT-01"
              type="submit"
              className="mt-2 w-full"
              disabled={!canSubmit}
            >
              {loading && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              {t("adminSignInButton")}
            </Button>

            <FieldDescription className="text-center text-sm text-muted-foreground">
              <Link to="/" className="underline underline-offset-4 hover:text-foreground">
                {t("adminSignInBackToSite")}
              </Link>
            </FieldDescription>
          </form>
        </div>
      </div>

      {/* ACT-01: 로그인 제출 → SCR-014 */}
      <div
        data-testid="scr-013-act-01"
        data-act-code="ACT-01"
        data-trigger="로그인 제출"
        data-api="API-001,API-002,API-003"
        data-next="SCR-014"
        data-nav="SCR-014"
        className="sr-only"
        aria-hidden="true"
      >
        ACT-01 · 로그인 제출 · API-001/API-002/API-003 · 이동: SCR-014
      </div>
    </section>
  );
}
