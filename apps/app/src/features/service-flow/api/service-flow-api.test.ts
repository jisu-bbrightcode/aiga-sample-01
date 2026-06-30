import { describe, expect, it } from "vitest";
import { ServiceFlowError, statusToErrorCode } from "./service-flow-api";

describe("statusToErrorCode", () => {
  it("maps auth/permission statuses to stable codes", () => {
    expect(statusToErrorCode(401)).toBe("UNAUTHORIZED");
    expect(statusToErrorCode(403)).toBe("FORBIDDEN");
    expect(statusToErrorCode(404)).toBe("NOT_FOUND");
    expect(statusToErrorCode(429)).toBe("TOO_MANY_REQUESTS");
  });

  it("maps validation statuses to BAD_REQUEST", () => {
    expect(statusToErrorCode(400)).toBe("BAD_REQUEST");
    expect(statusToErrorCode(422)).toBe("BAD_REQUEST");
  });

  it("falls back to GENERIC for unmapped statuses (never leaks the raw status)", () => {
    expect(statusToErrorCode(500)).toBe("GENERIC");
    expect(statusToErrorCode(0)).toBe("GENERIC");
  });
});

describe("ServiceFlowError", () => {
  it("carries a code readable by getUserFacingErrorCode and never the server body as message", () => {
    const err = new ServiceFlowError("FORBIDDEN", 403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.status).toBe(403);
    // message is the stable code, not raw server text.
    expect(err.message).toBe("FORBIDDEN");
    expect(err).toBeInstanceOf(Error);
  });
});
