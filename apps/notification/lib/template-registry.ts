/**
 * Template key registry (PB-NOTI-001, acceptance #1:
 * "신규 알림 추가는 템플릿 키와 채널 설정으로 확장할 수 있다").
 *
 * Adding a new notification is a registry call + channel config — never a code
 * change in the service. Keys follow `<domain>.<event>` so notifications group
 * by the same domains as the rest of the build (auth / payment / service …).
 */

import {
  TEMPLATE_KEY_PATTERN,
  type Channel,
  type ChannelRenderer,
  type TemplateDefinition,
  type TemplateKey,
} from './types.ts';

/** Thrown for an invalid registration or an unknown lookup. */
export class TemplateRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateRegistryError';
  }
}

/**
 * Validate a `<domain>.<event>` key. Exposed so callers/tests can pre-check.
 */
export function isValidTemplateKey(key: string): boolean {
  return TEMPLATE_KEY_PATTERN.test(key);
}

/** Immutable registry of template definitions, keyed by template key. */
export class TemplateRegistry {
  readonly #templates: ReadonlyMap<TemplateKey, TemplateDefinition>;

  private constructor(templates: ReadonlyMap<TemplateKey, TemplateDefinition>) {
    this.#templates = templates;
  }

  /** Build a registry from a list of definitions (validates every entry). */
  static fromDefinitions(
    defs: readonly TemplateDefinition[],
  ): TemplateRegistry {
    const map = new Map<TemplateKey, TemplateDefinition>();
    for (const def of defs) {
      validateDefinition(def);
      if (map.has(def.key)) {
        throw new TemplateRegistryError(`duplicate template key: ${def.key}`);
      }
      map.set(def.key, def);
    }
    return new TemplateRegistry(map);
  }

  /** Empty registry — extend with {@link register}. */
  static empty(): TemplateRegistry {
    return new TemplateRegistry(new Map());
  }

  /**
   * Return a NEW registry with `def` added (immutable — never mutates `this`).
   * This is the extension point referenced by acceptance #1.
   */
  register(def: TemplateDefinition): TemplateRegistry {
    validateDefinition(def);
    if (this.#templates.has(def.key)) {
      throw new TemplateRegistryError(`duplicate template key: ${def.key}`);
    }
    const next = new Map(this.#templates);
    next.set(def.key, def);
    return new TemplateRegistry(next);
  }

  /** Look up a definition or throw a clear error. */
  resolve(key: TemplateKey): TemplateDefinition {
    const def = this.#templates.get(key);
    if (!def) {
      throw new TemplateRegistryError(`unknown template key: ${key}`);
    }
    return def;
  }

  has(key: TemplateKey): boolean {
    return this.#templates.has(key);
  }

  /** All registered keys, sorted — for diagnostics/admin listing. */
  keys(): TemplateKey[] {
    return [...this.#templates.keys()].sort();
  }
}

function validateDefinition(def: TemplateDefinition): void {
  if (!isValidTemplateKey(def.key)) {
    throw new TemplateRegistryError(
      `invalid template key "${def.key}" — expected <domain>.<event> (lowercase)`,
    );
  }
  if (def.channels.length === 0) {
    throw new TemplateRegistryError(
      `template ${def.key} declares no channels`,
    );
  }
  for (const ch of def.channels) {
    const renderer: ChannelRenderer | undefined = def.renderers[ch];
    if (!renderer) {
      throw new TemplateRegistryError(
        `template ${def.key} supports channel "${ch}" but has no renderer for it`,
      );
    }
  }
}

/**
 * Default AIGA template catalog — the common notifications the brief calls out
 * (가입/인증, 비밀번호 재설정, 결제, 주요 서비스 이벤트). Channel sets here are the
 * template's *capability*; what actually fires is intersected with the enabled
 * feature channels by the router (see channel-router.ts).
 */
export function defaultTemplates(): TemplateDefinition[] {
  const line = (s: string): string => s;
  return [
    {
      key: 'auth.email_verification',
      channels: ['email'],
      renderers: {
        email: (v) => ({
          subject: 'AIGA 이메일 인증',
          body: line(`아래 링크로 이메일을 인증해 주세요: ${v.verifyUrl}`),
        }),
      },
    },
    {
      key: 'auth.password_reset',
      channels: ['email'],
      renderers: {
        email: (v) => ({
          subject: '비밀번호 재설정',
          body: line(`비밀번호 재설정 링크: ${v.resetUrl} (30분간 유효)`),
        }),
      },
    },
    {
      key: 'payment.receipt',
      channels: ['email', 'alimtalk'],
      renderers: {
        email: (v) => ({
          subject: `결제 영수증 — ${v.orderId}`,
          body: line(`${v.amount}원 결제가 완료되었습니다. 주문번호 ${v.orderId}.`),
        }),
        alimtalk: (v) => ({
          body: line(`[AIGA] 결제 완료\n주문번호: ${v.orderId}\n금액: ${v.amount}원`),
          alimtalkTemplateCode: 'AIGA_PAYMENT_RECEIPT',
        }),
      },
    },
    {
      key: 'payment.failed',
      channels: ['email', 'alimtalk'],
      renderers: {
        email: (v) => ({
          subject: '결제 실패 안내',
          body: line(`주문 ${v.orderId} 결제가 실패했습니다. 사유: ${v.reason}`),
        }),
        alimtalk: (v) => ({
          body: line(`[AIGA] 결제 실패\n주문번호: ${v.orderId}`),
          alimtalkTemplateCode: 'AIGA_PAYMENT_FAILED',
        }),
      },
    },
    {
      key: 'service.welcome',
      channels: ['inapp', 'email'],
      renderers: {
        inapp: (v) => ({ body: line(`${v.name}님, AIGA에 오신 것을 환영합니다!`) }),
        email: (v) => ({
          subject: 'AIGA에 오신 것을 환영합니다',
          body: line(`${v.name}님, 가입을 환영합니다.`),
        }),
      },
    },
  ];
}
