import { BadRequestException } from "@nestjs/common";
import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createZodDto } from "./index";
import { ZodValidationPipe } from "./validation-pipe";

const createProjectSchema = z.object({
  name: z.string().min(1, "프로젝트 이름을 입력해주세요.").max(200),
  description: z.string().max(2000).optional(),
  aiMode: z.enum(["ai_powered", "ai_safety"]).default("ai_safety"),
});

class CreateProjectDto extends createZodDto(createProjectSchema) {}

function bodyMetadata(metatype: ArgumentMetadata["metatype"]): ArgumentMetadata {
  return { type: "body", metatype, data: undefined };
}

describe("ZodValidationPipe — zod DTO bodies", () => {
  it("parses a valid body and applies schema defaults (aiMode)", () => {
    const pipe = new ZodValidationPipe();
    const result = pipe.transform({ name: "pipe-fix-proof" }, bodyMetadata(CreateProjectDto));
    expect(result).toEqual({ name: "pipe-fix-proof", aiMode: "ai_safety" });
  });

  it("rejects an invalid body with BadRequestException (stable 400 shape)", () => {
    const pipe = new ZodValidationPipe();
    let caught: unknown;
    try {
      pipe.transform({ name: "" }, bodyMetadata(CreateProjectDto));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const exception = caught as BadRequestException;
    expect(exception.getStatus()).toBe(400);
    // GlobalExceptionFilter 가 response.message 를 그대로 노출 — zod issue 가 사람이 읽을 수
    // 있는 "path: message" 형태여야 한다. raw stack / JSON blob 금지.
    const response = exception.getResponse() as { message?: string };
    expect(response.message).toContain("name");
    expect(response.message).toContain("프로젝트 이름을 입력해주세요.");
    expect(response.message).not.toContain("at ");
  });

  it("rejects a body missing required fields", () => {
    const pipe = new ZodValidationPipe();
    expect(() => pipe.transform({}, bodyMetadata(CreateProjectDto))).toThrow(BadRequestException);
  });

  it("strips unknown keys silently (whitelist semantics, matches previous tRPC zod parse)", () => {
    const pipe = new ZodValidationPipe();
    const result = pipe.transform(
      { name: "ok", evil: "ignored" },
      bodyMetadata(CreateProjectDto),
    );
    expect(result).toEqual({ name: "ok", aiMode: "ai_safety" });
    expect(result).not.toHaveProperty("evil");
  });
});

describe("ZodValidationPipe — non-zod metatypes", () => {
  it("passes primitives through untouched when no fallback is provided", () => {
    const pipe = new ZodValidationPipe();
    const metadata: ArgumentMetadata = { type: "param", metatype: String, data: "id" };
    expect(pipe.transform("abc-123", metadata)).toBe("abc-123");
  });

  it("passes through when metatype is undefined", () => {
    const pipe = new ZodValidationPipe();
    const metadata: ArgumentMetadata = { type: "query", metatype: undefined, data: undefined };
    expect(pipe.transform({ q: "x" }, metadata)).toEqual({ q: "x" });
  });

  it("delegates non-zod class metatypes to the wrapped fallback pipe", () => {
    class PlainDto {
      name!: string;
    }
    const fallback: PipeTransform = { transform: vi.fn().mockReturnValue("delegated") };
    const pipe = new ZodValidationPipe(fallback);
    const metadata = bodyMetadata(PlainDto);
    const result = pipe.transform({ name: "x" }, metadata);
    expect(result).toBe("delegated");
    expect(fallback.transform).toHaveBeenCalledWith({ name: "x" }, metadata);
  });

  it("delegates primitives to the fallback pipe when one is provided", () => {
    const fallback: PipeTransform = { transform: vi.fn().mockReturnValue(42) };
    const pipe = new ZodValidationPipe(fallback);
    const metadata: ArgumentMetadata = { type: "param", metatype: Number, data: "count" };
    expect(pipe.transform("42", metadata)).toBe(42);
  });

  it("does NOT delegate zod DTOs to the fallback (class-validator whitelist must not see them)", () => {
    const fallback: PipeTransform = { transform: vi.fn() };
    const pipe = new ZodValidationPipe(fallback);
    pipe.transform({ name: "ok" }, bodyMetadata(CreateProjectDto));
    expect(fallback.transform).not.toHaveBeenCalled();
  });
});
