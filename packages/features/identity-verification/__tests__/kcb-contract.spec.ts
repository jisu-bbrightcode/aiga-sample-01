import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { identityVerificationCapabilityRegistry } from "../capability-registry";
import { KcbAdapterClient, KcbIdentityVerificationError } from "../kcb";
import { getIdentityVerificationMessage } from "../ui";

describe("KCB identity verification reusable boundary", () => {
  it("reports blockers instead of fabricating provider readiness when adapter env is missing", async () => {
    const health = await new KcbAdapterClient().health();

    assert.equal(health.ok, false);
    assert.equal(health.adapterConfigured, false);
    assert.equal(health.officialSourceMapped, false);
    assert.ok(health.blockers.includes("configuration_required"));
    assert.ok(health.blockers.includes("official_documents_required"));
    assert.ok(health.blockers.includes("jar_required"));
    assert.ok(health.blockers.includes("site_code_required"));
  });

  it("exports Product Builder REUSE capability IDs", () => {
    const ids = identityVerificationCapabilityRegistry.map((item) => item.id);

    assert.ok(ids.includes("identity-verification.kcb.standard"));
    assert.ok(ids.includes("identity-verification.kcb.jar-bridge"));
    assert.ok(ids.includes("identity-verification.kcb.rest-api"));
    assert.ok(ids.includes("identity-verification.kcb.ui"));
    assert.ok(ids.includes("identity-verification.kcb.admin"));
  });

  it("uses stable localized blocker copy instead of raw provider messages", () => {
    assert.equal(
      getIdentityVerificationMessage("configuration_required", "ko"),
      "본인확인 서비스 설정이 아직 완료되지 않았습니다.",
    );
    assert.equal(
      getIdentityVerificationMessage("configuration_required", "en"),
      "Identity verification is not configured yet.",
    );
    assert.equal(
      getIdentityVerificationMessage("configuration_required", "ja"),
      "本人確認サービスの設定がまだ完了していません。",
    );
    assert.equal(
      getIdentityVerificationMessage("configuration_required", "zh"),
      "身份验证服务尚未配置完成。",
    );
  });

  it("preserves stable adapter blocker codes from the Java service", async () => {
    const client = new KcbAdapterClient({
      baseUrl: "https://kcb.internal",
      internalAuthToken: "token",
      fetchImpl: async () =>
        new Response(JSON.stringify({ code: "site_code_required" }), {
          status: 412,
          headers: { "content-type": "application/json" },
        }),
    });

    await assert.rejects(
      () =>
        client.createStandardRequest({
          requestId: "request",
          sessionId: "018f7a0d-3e0d-7000-9000-000000000001",
          state: "state-state-state-state",
          nonce: "nonce-nonce-nonce-nonce",
          targetAction: "signup",
        }),
      (error) =>
        error instanceof KcbIdentityVerificationError && error.code === "site_code_required",
    );
  });
});
