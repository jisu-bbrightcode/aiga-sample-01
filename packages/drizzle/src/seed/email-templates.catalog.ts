/**
 * Email template seed catalog (PB-NOTI-EMAIL-DATA-001 / BBR-655).
 *
 * Pure data + validation, no DB I/O — imported by the seed runner
 * (`email-templates.ts`) and unit-tested by `email-templates.catalog.test.ts`.
 *
 * Each entry defines a stable template key, its category, the React renderer it
 * maps to (`templateType`), and an initial published version (v1) with the
 * variable schema the template expects. Seed keys cover the acceptance-criteria
 * groups: 인증(auth) · 비밀번호 재설정(password) · 트랜잭션(transactional).
 */
import type {
  EmailTemplateCategory,
  EmailTemplateType,
} from "../schema/features/email/enums";

/** A single declared variable a template version expects. */
export interface TemplateVariableSpec {
  type: "string";
  required: boolean;
  description: string;
}

export interface EmailTemplateSeedVersion {
  version: number;
  subject: string;
  changelog: string;
  variableSchema: Record<string, TemplateVariableSpec>;
}

export interface EmailTemplateSeed {
  key: string;
  name: string;
  category: EmailTemplateCategory;
  /** React renderer selector (existing `email_template_type` enum). */
  templateType: EmailTemplateType;
  description: string;
  /** Published initial version. */
  version: EmailTemplateSeedVersion;
}

const v = (required: boolean, description: string): TemplateVariableSpec => ({
  type: "string",
  required,
  description,
});

/**
 * Seed catalog. Keys are stable dotted identifiers; the renderer is the
 * existing template-type enum so existing send paths keep working.
 */
export const EMAIL_TEMPLATE_SEEDS: readonly EmailTemplateSeed[] = [
  {
    key: "auth.welcome",
    name: "가입 환영 메일",
    category: "auth",
    templateType: "welcome",
    description: "신규 가입자에게 보내는 환영 메일",
    version: {
      version: 1,
      subject: "AIGA에 오신 것을 환영합니다",
      changelog: "initial seed",
      variableSchema: {
        userName: v(true, "수신자 이름"),
        loginUrl: v(true, "로그인 페이지 URL"),
      },
    },
  },
  {
    key: "auth.email-verification",
    name: "이메일 인증",
    category: "auth",
    templateType: "email-verification",
    description: "이메일 소유 확인을 위한 인증 메일",
    version: {
      version: 1,
      subject: "이메일 인증을 완료해 주세요",
      changelog: "initial seed",
      variableSchema: {
        userName: v(true, "수신자 이름"),
        verifyUrl: v(true, "이메일 인증 링크"),
      },
    },
  },
  {
    key: "password.password-reset",
    name: "비밀번호 재설정",
    category: "password",
    templateType: "password-reset",
    description: "비밀번호 재설정 링크 안내 메일",
    version: {
      version: 1,
      subject: "비밀번호 재설정 안내",
      changelog: "initial seed",
      variableSchema: {
        userName: v(true, "수신자 이름"),
        resetUrl: v(true, "비밀번호 재설정 링크"),
        expiresIn: v(true, "링크 만료 시간 (예: 30분)"),
      },
    },
  },
  {
    key: "password.password-changed",
    name: "비밀번호 변경 완료",
    category: "password",
    templateType: "password-changed",
    description: "비밀번호 변경 완료 후 보안 안내 메일",
    version: {
      version: 1,
      subject: "비밀번호가 변경되었습니다",
      changelog: "initial seed",
      variableSchema: {
        userName: v(true, "수신자 이름"),
        changedAt: v(true, "변경 일시"),
        supportUrl: v(true, "고객지원 URL"),
      },
    },
  },
  {
    key: "transactional.notification",
    name: "일반 알림",
    category: "transactional",
    templateType: "notification",
    description: "트랜잭션/일반 알림 메일",
    version: {
      version: 1,
      subject: "{{title}}",
      changelog: "initial seed",
      variableSchema: {
        title: v(true, "알림 제목"),
        body: v(true, "알림 본문"),
        actionLabel: v(false, "액션 버튼 라벨"),
        actionUrl: v(false, "액션 버튼 URL"),
      },
    },
  },
];

/**
 * Validate the seed catalog is internally consistent. Returns the list of
 * problems (empty = valid). Pure — safe to call from tests and the runner.
 */
export function validateEmailTemplateSeeds(
  seeds: readonly EmailTemplateSeed[] = EMAIL_TEMPLATE_SEEDS,
): string[] {
  const problems: string[] = [];
  const seenKeys = new Set<string>();

  for (const seed of seeds) {
    if (seenKeys.has(seed.key)) {
      problems.push(`duplicate key: ${seed.key}`);
    }
    seenKeys.add(seed.key);

    if (seed.version.version < 1) {
      problems.push(`${seed.key}: version must be >= 1`);
    }
    if (seed.version.subject.trim() === "") {
      problems.push(`${seed.key}: subject must not be empty`);
    }
  }

  // Acceptance criteria: 인증 / 비밀번호 재설정 / 트랜잭션 seed key가 정의되어야 한다.
  const requiredCategories: EmailTemplateCategory[] = ["auth", "password", "transactional"];
  for (const category of requiredCategories) {
    if (!seeds.some((s) => s.category === category)) {
      problems.push(`missing required category: ${category}`);
    }
  }

  return problems;
}
