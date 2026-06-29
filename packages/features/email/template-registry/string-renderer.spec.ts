import { resolveRenderer } from "./renderer-resolver";
import { renderTemplateString } from "./string-renderer";

describe("renderTemplateString", () => {
  it("interpolates {{ var }} placeholders (with and without whitespace)", () => {
    const result = renderTemplateString("{{title}} — {{ actionLabel }}", {
      title: "주문 완료",
      actionLabel: "확인하기",
    });

    expect(result.output).toBe("주문 완료 — 확인하기");
    expect(result.missing).toEqual([]);
  });

  it("reports missing placeholders and renders them as empty", () => {
    const result = renderTemplateString("안녕하세요 {{userName}}님, {{missing}}", {
      userName: "홍길동",
    });

    expect(result.output).toBe("안녕하세요 홍길동님, ");
    expect(result.missing).toEqual(["missing"]);
  });

  it("stringifies non-string values and leaves text without placeholders intact", () => {
    expect(renderTemplateString("count: {{n}}", { n: 3 }).output).toBe("count: 3");
    expect(renderTemplateString("no placeholders", {}).output).toBe("no placeholders");
  });
});

describe("resolveRenderer", () => {
  it("maps seeded keys to their React renderer via the last segment", () => {
    expect(resolveRenderer("auth.welcome")).toBe("welcome");
    expect(resolveRenderer("auth.email-verification")).toBe("email-verification");
    expect(resolveRenderer("password.password-reset")).toBe("password-reset");
    expect(resolveRenderer("password.password-changed")).toBe("password-changed");
    expect(resolveRenderer("transactional.notification")).toBe("notification");
  });

  it("returns null when the key suffix is not a known renderer", () => {
    expect(resolveRenderer("marketing.custom-blast")).toBeNull();
    expect(resolveRenderer("welcome-but-not-exact")).toBeNull();
  });
});
