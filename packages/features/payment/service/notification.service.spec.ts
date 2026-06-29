/**
 * NotificationService — Resend wrapper + react-email template snapshots.
 *
 * Service-level tests:
 *  1. onPaymentSucceeded sends with correct from/to/subject/html
 *  2. onTopUpCompleted sends with credits + amount in body
 *  3. apiKey empty (CI / pre-Phase 13) → silently skip, no client constructed
 *
 * Template render snapshots (substring assertions, NOT full HTML — Resend
 * versioning would invalidate full snapshots too easily):
 *  4-9. One per template — checks subject + key copy elements present.
 */
import { render } from "@react-email/render";
import type { Resend } from "resend";
import {
  PaymentFailedEmail,
  PaymentSucceededEmail,
  RefundCompletedEmail,
  RenewalUpcomingEmail,
  SoftSuspendEmail,
  TopUpCompletedEmail,
  paymentFailedSubject,
  paymentSucceededSubject,
  refundCompletedSubject,
  renewalUpcomingSubject,
  softSuspendSubject,
  topUpCompletedSubject,
} from "../templates";
import { NotificationService } from "./notification.service";

interface FakeResend {
  emails: { send: jest.Mock };
}

function makeFake(): FakeResend {
  return {
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "msg_1" }, error: null }),
    },
  };
}

describe("NotificationService", () => {
  const FROM = "Product Builder <noreply@example.com>";

  it("onPaymentSucceeded sends via Resend with correct envelope", async () => {
    const fake = makeFake();
    const svc = new NotificationService(
      { apiKey: "re_test", from: FROM },
      fake as unknown as Resend,
    );
    await svc.onPaymentSucceeded({
      id: "sub_1",
      organizationId: "org_1",
      userEmail: "u@example.com",
      amountCents: 1900,
      planName: "Pro Monthly",
    });
    expect(fake.emails.send).toHaveBeenCalledTimes(1);
    const args = fake.emails.send.mock.calls[0]![0];
    expect(args.from).toBe(FROM);
    expect(args.to).toBe("u@example.com");
    expect(args.subject).toContain("결제 완료");
    expect(args.subject).toContain("Pro Monthly");
    expect(args.html).toContain("$19.00");
  });

  it("onTopUpCompleted sends with credits + amount", async () => {
    const fake = makeFake();
    const svc = new NotificationService(
      { apiKey: "re_test", from: FROM },
      fake as unknown as Resend,
    );
    await svc.onTopUpCompleted({
      orderId: "ord_1",
      organizationId: "org_1",
      userEmail: "u@example.com",
      amountCents: 4900,
      credits: 5000,
      newBalance: 7500,
    });
    expect(fake.emails.send).toHaveBeenCalledTimes(1);
    const args = fake.emails.send.mock.calls[0]![0];
    expect(args.subject).toContain("크레딧");
    expect(args.html).toContain("5000");
    expect(args.html).toContain("$49.00");
  });

  it("disabled in test mode (apiKey empty) → silently skip", async () => {
    const svc = new NotificationService({ apiKey: "", from: FROM });
    expect(svc.enabled).toBe(false);
    // None of the calls should throw or do anything observable.
    await expect(
      svc.onPaymentSucceeded({
        id: "sub_1",
        organizationId: "org_1",
        userEmail: "u@example.com",
        amountCents: 1900,
      }),
    ).resolves.toBeUndefined();
    await expect(
      svc.onTopUpCompleted({
        orderId: "ord_1",
        organizationId: "org_1",
        userEmail: "u@example.com",
        amountCents: 4900,
        credits: 5000,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("payment email templates (Phase 12)", () => {
  it("payment-succeeded renders subject + plan + amount", async () => {
    const props = {
      planName: "Pro Monthly",
      amountCents: 1900,
      nextBillingDate: new Date("2026-05-25"),
      userName: "지영",
    };
    const html = await render(PaymentSucceededEmail(props));
    expect(paymentSucceededSubject(props)).toBe(
      "[Product Builder] 결제 완료 — Pro Monthly",
    );
    expect(html).toContain("결제 완료");
    expect(html).toContain("Pro Monthly");
    expect(html).toContain("$19.00");
    expect(html).toContain("2026-05-25");
    expect(html).toContain("지영");
  });

  it("payment-failed renders subject + reason + grace period warning", async () => {
    const props = {
      planName: "Pro Monthly",
      reason: "card_declined",
      gracePeriodEndsAt: new Date("2026-05-02"),
      retryUrl: "https://example.com/billing/retry",
    };
    const html = await render(PaymentFailedEmail(props));
    expect(paymentFailedSubject(props)).toBe(
      "[Product Builder] 결제 실패 — 카드 정보를 확인해주세요",
    );
    expect(html).toContain("결제 실패");
    expect(html).toContain("card_declined");
    expect(html).toContain("2026-05-02");
    expect(html).toContain("https://example.com/billing/retry");
  });

  it("renewal-upcoming renders subject + plan + amount + date", async () => {
    const props = {
      planName: "Pro Monthly",
      amountCents: 1900,
      renewsAt: new Date("2026-05-02"),
    };
    const html = await render(RenewalUpcomingEmail(props));
    expect(renewalUpcomingSubject(props)).toBe(
      "[Product Builder] 7일 후 자동 갱신 안내",
    );
    expect(html).toContain("자동 갱신");
    expect(html).toContain("Pro Monthly");
    expect(html).toContain("$19.00");
    expect(html).toContain("2026-05-02");
  });

  it("refund-completed renders subject + amount + refundId", async () => {
    const props = {
      amountCents: 1900,
      refundId: "rfnd_abc123",
      reason: "고객 요청",
    };
    const html = await render(RefundCompletedEmail(props));
    expect(refundCompletedSubject(props)).toBe("[Product Builder] 환불 완료");
    expect(html).toContain("환불 완료");
    expect(html).toContain("$19.00");
    expect(html).toContain("rfnd_abc123");
    expect(html).toContain("고객 요청");
  });

  it("soft-suspend renders subject + grace + purge + restoreUrl button", async () => {
    const props = {
      planName: "Pro Monthly",
      gracePeriodEndsAt: new Date("2026-05-02"),
      dataPurgeAt: new Date("2026-08-01"),
      restoreUrl: "https://example.com/billing",
    };
    const html = await render(SoftSuspendEmail(props));
    expect(softSuspendSubject(props)).toBe(
      "[Product Builder] 서비스 일시 제한 — 7일 이내 결제 정상화 필요",
    );
    expect(html).toContain("서비스 일시 제한");
    expect(html).toContain("Pro Monthly");
    expect(html).toContain("2026-05-02");
    expect(html).toContain("2026-08-01");
    expect(html).toContain("https://example.com/billing");
    expect(html).toContain("결제 수단 업데이트");
  });

  it("topup-completed renders subject + credits + amount + balance + usage CTA", async () => {
    const props = {
      credits: 5000,
      amountCents: 4900,
      newBalance: 7500,
    };
    const html = await render(TopUpCompletedEmail(props));
    expect(topUpCompletedSubject(props)).toBe(
      "[Product Builder] 크레딧 충전 완료 — 5000cr",
    );
    expect(html).toContain("크레딧 충전 완료");
    expect(html).toContain("5000");
    expect(html).toContain("$49.00");
    expect(html).toContain("7500");
    expect(html).toContain("사용량 보기");
  });
});
