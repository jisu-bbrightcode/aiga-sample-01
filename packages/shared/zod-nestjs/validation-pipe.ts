import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";

/** createZodDto 가 반환 클래스에 부착하는 static 멤버 shape. */
interface ZodDtoMetatype {
  schema: { parse: (input: unknown) => unknown };
  create: (input: unknown) => unknown;
}

function isZodDto(metatype: ArgumentMetadata["metatype"]): metatype is ZodDtoMetatype &
  ArgumentMetadata["metatype"] {
  if (typeof metatype !== "function") return false;
  const candidate = metatype as unknown as Partial<ZodDtoMetatype>;
  return typeof candidate.create === "function" && candidate.schema !== undefined;
}

interface ZodIssueLike {
  path?: Array<string | number>;
  message?: string;
}

/**
 * zod parse 실패를 사람이 읽을 수 있는 "path: message" 목록으로 변환.
 * GlobalExceptionFilter 가 response.message 를 그대로 노출하므로
 * raw stack / JSON blob 이 새어나가면 안 된다.
 */
function formatZodIssues(error: unknown): string {
  const issues = (error as { issues?: ZodIssueLike[] } | null)?.issues;
  if (!Array.isArray(issues) || issues.length === 0) {
    return "요청 본문이 올바르지 않습니다.";
  }
  return issues
    .map((issue) => {
      const path =
        Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join(".") : "body";
      return `${path}: ${issue.message ?? "올바르지 않은 값입니다."}`;
    })
    .join("; ");
}

/**
 * zod-aware 글로벌 validation pipe.
 *
 * - metatype 이 createZodDto 클래스(static create/schema 보유)면 schema.parse 로
 *   REAL zod 검증을 수행한다. 실패 시 BadRequestException (GlobalExceptionFilter 를
 *   거쳐 { error: { code: "BAD_REQUEST", message } } 의 안정적 400 shape).
 *   zod object schema 기본 semantics 에 따라 unknown key 는 silent strip
 *   (= 기존 tRPC input parse 와 동일한 whitelist 동작).
 * - 그 외 metatype (class-validator DTO, String/Number 등 primitive)은
 *   생성자에 주입된 fallback pipe (기존 ValidationPipe)에 그대로 위임하고,
 *   fallback 이 없으면 값을 그대로 통과시킨다.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly fallback?: PipeTransform) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const { metatype } = metadata;

    if (isZodDto(metatype)) {
      try {
        return metatype.create(value);
      } catch (error) {
        throw new BadRequestException(formatZodIssues(error));
      }
    }

    if (this.fallback) {
      return this.fallback.transform(value, metadata);
    }

    return value;
  }
}
