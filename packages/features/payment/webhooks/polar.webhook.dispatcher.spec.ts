/**
 * PolarWebhookDispatcher — unit tests with all downstream deps mocked.
 *
 * No DB, no Resend, no fastify. We only verify routing + correct argument
 * shape per event type. The downstream services already have their own
 * idempotency / ledger / etc. specs.
 *
 * 7 tests — Phase 5 G4.
 */
import {
  PolarWebhookDispatcher,
  type CouponService,
  type DunningService,
  type WebhookHandlerDeps,
} from "./polar.webhook.dispatcher";
import type { CreditLedgerService } from "../service/credit-ledger.service";
import type { NotificationService } from "../service/notification.service";
import type { OrderMirrorService } from "../service/order-mirror.service";
import type { SubscriptionService } from "../service/subscription.service";

interface Mocks {
  subSvc: { processEvent: jest.Mock; findByPolarId: jest.Mock };
  ledger: {
    grantSubscriptionCycle: jest.Mock;
    grantTopUp: jest.Mock;
    refundReverse: jest.Mock;
  };
  dunning: { markPastDue: jest.Mock };
  coupon: { recordRedemption: jest.Mock };
  notif: {
    onSubscriptionCreated: jest.Mock;
    onPaymentSucceeded: jest.Mock;
    onTopUpCompleted: jest.Mock;
    onRefundCompleted: jest.Mock;
  };
  orderMirror: {
    upsertFromOrderPaid: jest.Mock;
    upsertFromOrderRefunded: jest.Mock;
    getOrganizationByPolarOrderId: jest.Mock;
  };
}

function makeMocks(): Mocks {
  return {
    subSvc: {
      processEvent: jest
        .fn()
        .mockResolvedValue({ processed: true, subscriptionId: "sub_internal_1" }),
      findByPolarId: jest.fn(),
    },
    ledger: {
      grantSubscriptionCycle: jest
        .fn()
        .mockResolvedValue({ ledgerEntry: null, balanceAfter: 1000 }),
      grantTopUp: jest
        .fn()
        .mockResolvedValue({ ledgerEntry: null, balanceAfter: 6000 }),
      refundReverse: jest.fn().mockResolvedValue({ reverted: 1000 }),
    },
    dunning: { markPastDue: jest.fn().mockResolvedValue(undefined) },
    coupon: { recordRedemption: jest.fn().mockResolvedValue(undefined) },
    notif: {
      onSubscriptionCreated: jest.fn().mockResolvedValue(undefined),
      onPaymentSucceeded: jest.fn().mockResolvedValue(undefined),
      onTopUpCompleted: jest.fn().mockResolvedValue(undefined),
      onRefundCompleted: jest.fn().mockResolvedValue(undefined),
    },
    orderMirror: {
      upsertFromOrderPaid: jest.fn().mockResolvedValue(undefined),
      upsertFromOrderRefunded: jest.fn().mockResolvedValue(undefined),
      getOrganizationByPolarOrderId: jest.fn().mockResolvedValue(undefined),
    },
  };
}

function build(mocks: Mocks): PolarWebhookDispatcher {
  const deps: WebhookHandlerDeps = {
    subSvc: mocks.subSvc as unknown as SubscriptionService,
    ledger: mocks.ledger as unknown as CreditLedgerService,
    dunning: mocks.dunning as unknown as DunningService,
    coupon: mocks.coupon as unknown as CouponService,
    notif: mocks.notif as unknown as NotificationService,
    orderMirror: mocks.orderMirror as unknown as OrderMirrorService,
  };
  return new PolarWebhookDispatcher(deps);
}

const PERIOD_START = "2026-04-01T00:00:00.000Z";
const PERIOD_END = "2026-05-01T00:00:00.000Z";

describe("PolarWebhookDispatcher", () => {
  it("subscription.created → processEvent + onSubscriptionCreated", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "subscription.created",
        data: {
          id: "polar_sub_1",
          status: "active",
          current_period_start: PERIOD_START,
          current_period_end: PERIOD_END,
          customer_id: "cust_1",
          product_id: "prod_1",
          metadata: {
            organization_id: "org_1",
            user_id: "u1",
            plan_id: "plan_1",
            user_email: "u@example.com",
          },
        },
      },
      "evt_1",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.subSvc.processEvent).toHaveBeenCalledTimes(1);
    const evtArg = m.subSvc.processEvent.mock.calls[0]![0];
    expect(evtArg.polarEventId).toBe("evt_1");
    expect(evtArg.type).toBe("subscription.created");
    expect(evtArg.payload.id).toBe("polar_sub_1");
    expect(evtArg.payload.organizationId).toBe("org_1");
    expect(m.notif.onSubscriptionCreated).toHaveBeenCalledTimes(1);
    expect(
      m.notif.onSubscriptionCreated.mock.calls[0]![0].userEmail,
    ).toBe("u@example.com");
  });

  it("subscription.updated → processEvent only, no notification", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "subscription.updated",
        data: {
          id: "polar_sub_1",
          status: "past_due",
          current_period_start: PERIOD_START,
          current_period_end: PERIOD_END,
          customer_id: "cust_1",
          product_id: "prod_1",
          metadata: {
            organization_id: "org_1",
            user_id: "u1",
            plan_id: "plan_1",
          },
        },
      },
      "evt_2",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.subSvc.processEvent).toHaveBeenCalledTimes(1);
    expect(m.notif.onSubscriptionCreated).not.toHaveBeenCalled();
  });

  it("payment.succeeded → grantSubscriptionCycle + onPaymentSucceeded (sub exists)", async () => {
    const m = makeMocks();
    m.subSvc.findByPolarId.mockResolvedValue({
      id: "sub_internal_1",
      organizationId: "org_1",
      includedCreditsPerCycle: 1000,
      planSlug: "pro-monthly",
      // [L fix] periodKey is now derived from sub.currentPeriodStart, not
      // payload.data.period_start (which order.paid does not carry).
      currentPeriodStart: new Date(PERIOD_START),
    });
    const out = await build(m).dispatch(
      {
        type: "payment.succeeded",
        data: {
          subscription_id: "polar_sub_1",
          amount: 1900,
          metadata: { user_email: "u@example.com" },
        },
      },
      "evt_3",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.ledger.grantSubscriptionCycle).toHaveBeenCalledTimes(1);
    expect(m.ledger.grantSubscriptionCycle.mock.calls[0]![0]).toMatchObject({
      organizationId: "org_1",
      amount: 1000,
      subscriptionId: "sub_internal_1",
      periodKey: PERIOD_START,
    });
    expect(m.notif.onPaymentSucceeded).toHaveBeenCalledTimes(1);
    expect(m.notif.onPaymentSucceeded.mock.calls[0]![0]).toMatchObject({
      amountCents: 1900,
      planName: "pro-monthly",
    });
  });

  it("payment.succeeded → deferred when sub not found", async () => {
    const m = makeMocks();
    m.subSvc.findByPolarId.mockResolvedValue(null);
    const out = await build(m).dispatch(
      {
        type: "payment.succeeded",
        data: { subscription_id: "polar_sub_unknown" },
      },
      "evt_4",
    );
    expect(out.result).toBe("deferred");
    expect(m.ledger.grantSubscriptionCycle).not.toHaveBeenCalled();
    expect(m.notif.onPaymentSucceeded).not.toHaveBeenCalled();
  });

  it("payment.failed → dunning.markPastDue", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "payment.failed",
        data: {
          subscription_id: "polar_sub_1",
          failure_reason: "card_declined",
        },
      },
      "evt_5",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.dunning.markPastDue).toHaveBeenCalledWith({
      polarSubscriptionId: "polar_sub_1",
      reason: "card_declined",
    });
  });

  it("order.completed (kind=topup) → grantTopUp + onTopUpCompleted", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "order.completed",
        data: {
          id: "ord_1",
          amount: 4900,
          metadata: {
            kind: "topup",
            organization_id: "org_1",
            credits: "5000",
            user_email: "u@example.com",
          },
        },
      },
      "evt_6",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.ledger.grantTopUp).toHaveBeenCalledWith({
      organizationId: "org_1",
      amount: 5000,
      orderId: "ord_1",
    });
    expect(m.notif.onTopUpCompleted).toHaveBeenCalledTimes(1);
    expect(m.notif.onTopUpCompleted.mock.calls[0]![0]).toMatchObject({
      orderId: "ord_1",
      credits: 5000,
      amountCents: 4900,
    });
  });

  it("refund.completed → refundReverse + onRefundCompleted", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "refund.completed",
        data: {
          id: "ref_1",
          status: "succeeded",
          amount: 1900,
          metadata: {
            organization_id: "org_1",
            order_id: "ord_1",
            user_email: "u@example.com",
          },
        },
      },
      "evt_7",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.ledger.refundReverse).toHaveBeenCalledWith({
      organizationId: "org_1",
      refundId: "ref_1",
      subscriptionPeriodKey: undefined,
      orderId: "ord_1",
    });
    expect(m.notif.onRefundCompleted).toHaveBeenCalledTimes(1);
  });

  it("discount.applied → coupon.recordRedemption", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "discount.applied",
        data: {
          discount_id: "polar_disc_1",
          subscription_id: "polar_sub_99",
          metadata: { organization_id: "org_1" },
        },
      },
      "evt_disc_1",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.coupon.recordRedemption).toHaveBeenCalledWith({
      polarDiscountId: "polar_disc_1",
      polarEventRef: "evt_disc_1",
      organizationId: "org_1",
      subscriptionId: "polar_sub_99",
      orderId: undefined,
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Polar event-name reconciliation (Phase 14): the actual Polar event
  // names differ from the spec. These cover the renamed routing paths
  // without removing the legacy aliases above.
  // ──────────────────────────────────────────────────────────────────

  it("order.paid (recurring with subscription_id) → grantSubscriptionCycle", async () => {
    const m = makeMocks();
    m.subSvc.findByPolarId.mockResolvedValue({
      id: "sub_internal_1",
      organizationId: "org_1",
      includedCreditsPerCycle: 1000,
      planSlug: "pro-monthly",
      currentPeriodStart: new Date(PERIOD_START),
    });
    const out = await build(m).dispatch(
      {
        type: "order.paid",
        data: {
          subscription_id: "polar_sub_1",
          amount: 1900,
          metadata: { user_email: "u@example.com" },
        },
      },
      "evt_op_1",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.ledger.grantSubscriptionCycle).toHaveBeenCalledTimes(1);
    expect(m.ledger.grantSubscriptionCycle.mock.calls[0]![0]).toMatchObject({
      organizationId: "org_1",
      amount: 1000,
      subscriptionId: "sub_internal_1",
      periodKey: PERIOD_START,
    });
    expect(m.ledger.grantTopUp).not.toHaveBeenCalled();
  });

  it("order.paid (top-up with metadata.kind=topup) → grantTopUp", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "order.paid",
        data: {
          id: "ord_1",
          amount: 4900,
          metadata: {
            kind: "topup",
            organization_id: "org_1",
            credits: "5000",
            user_email: "u@example.com",
          },
        },
      },
      "evt_op_2",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.ledger.grantTopUp).toHaveBeenCalledWith({
      organizationId: "org_1",
      amount: 5000,
      orderId: "ord_1",
    });
    expect(m.ledger.grantSubscriptionCycle).not.toHaveBeenCalled();
  });

  it("subscription.updated → SubEvent.payload.polarProductId 포함 (Option A v2 plan-change mirror)", async () => {
    const m = makeMocks();
    // Lazy import keeps the fixture out of the shared index.ts (kept local
    // to the v2 plan-change scenario; it has no metadata.plan_id on purpose).
    const planChangedFixture = require(
      "../__fixtures__/polar/subscription-plan-changed.json",
    ) as { type: string; data: Record<string, unknown> };
    const out = await build(m).dispatch(
      {
        type: planChangedFixture.type,
        data: planChangedFixture.data as never,
      },
      "evt_plan_change",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.subSvc.processEvent).toHaveBeenCalledTimes(1);
    expect(m.subSvc.processEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        polarEventId: "evt_plan_change",
        type: "subscription.updated",
        payload: expect.objectContaining({
          id: "sub_test_changed",
          polarProductId: "prod_premium_v2",
        }),
      }),
    );
  });

  it("subscription.updated (status=past_due) → dunning.markPastDue", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "subscription.updated",
        data: {
          id: "polar_sub_1",
          status: "past_due",
          current_period_start: PERIOD_START,
          current_period_end: PERIOD_END,
          customer_id: "cust_1",
          product_id: "prod_1",
          metadata: {
            organization_id: "org_1",
            user_id: "u1",
            plan_id: "plan_1",
          },
        },
      },
      "evt_pd_1",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.subSvc.processEvent).toHaveBeenCalledTimes(1);
    expect(m.dunning.markPastDue).toHaveBeenCalledWith({
      polarSubscriptionId: "polar_sub_1",
      reason: "subscription.updated",
    });
  });

  it("refund.created → refundReverse + onRefundCompleted", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "refund.created",
        data: {
          id: "ref_2",
          status: "succeeded",
          amount: 1900,
          metadata: {
            organization_id: "org_1",
            order_id: "ord_2",
            user_email: "u@example.com",
          },
        },
      },
      "evt_ref_1",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.ledger.refundReverse).toHaveBeenCalledWith({
      organizationId: "org_1",
      refundId: "ref_2",
      subscriptionPeriodKey: undefined,
      orderId: "ord_2",
    });
    expect(m.notif.onRefundCompleted).toHaveBeenCalledTimes(1);
  });

  it("deferred result → calls deferredLogger.recordDeferred with next_retry_at ≈ now+5min", async () => {
    const m = makeMocks();
    m.subSvc.findByPolarId.mockResolvedValue(null); // forces deferred
    const recordDeferred = jest.fn().mockResolvedValue(undefined);
    const deps = {
      subSvc: m.subSvc as unknown as SubscriptionService,
      ledger: m.ledger as unknown as CreditLedgerService,
      dunning: m.dunning as unknown as DunningService,
      coupon: m.coupon as unknown as CouponService,
      notif: m.notif as unknown as NotificationService,
      orderMirror: m.orderMirror as unknown as OrderMirrorService,
      deferredLogger: { recordDeferred },
    };
    const dispatcher = new PolarWebhookDispatcher(deps);
    const before = Date.now();
    const out = await dispatcher.dispatch(
      {
        type: "payment.succeeded",
        data: { subscription_id: "polar_sub_unknown" },
      },
      "evt_def_1",
    );
    expect(out.result).toBe("deferred");
    expect(recordDeferred).toHaveBeenCalledTimes(1);
    const arg = recordDeferred.mock.calls[0]![0];
    expect(arg.polarEventId).toBe("evt_def_1");
    expect(arg.eventType).toBe("payment.succeeded");
    expect(arg.payload).toEqual({ subscription_id: "polar_sub_unknown" });
    expect(typeof arg.reason).toBe("string");
    const expected = before + 5 * 60_000;
    // ≈ now+5min, generous 10s tolerance for slow CI.
    expect(Math.abs(arg.nextRetryAt.getTime() - expected)).toBeLessThan(10_000);
  });
});

// ────────────────────────────────────────────────────────────────────
// Task 2 — fixture snapshot parse + dispatcher integration per fixture.
// Pulled from sandbox payloads in __fixtures__/polar/. If Polar drifts,
// recapture the JSON and re-run; the failure is the diff.
// ────────────────────────────────────────────────────────────────────

import * as fixtures from "../__fixtures__/polar";
import {
  polarOrderPaidDataSchema,
  polarOrderRefundedDataSchema,
  polarSubscriptionDataSchema,
  polarRefundDataSchema,
} from "./polar.payload.schema";

describe("PolarWebhookDispatcher — fixture snapshot parse", () => {
  it.each([
    ["orderPaidSubscription", fixtures.orderPaidSubscription, polarOrderPaidDataSchema],
    ["orderPaidTopup", fixtures.orderPaidTopup, polarOrderPaidDataSchema],
    ["orderRefunded", fixtures.orderRefunded, polarOrderRefundedDataSchema],
    ["subscriptionCreated", fixtures.subscriptionCreated, polarSubscriptionDataSchema],
    ["subscriptionUpdated", fixtures.subscriptionUpdated, polarSubscriptionDataSchema],
    ["subscriptionActive", fixtures.subscriptionActive, polarSubscriptionDataSchema],
    ["subscriptionCanceled", fixtures.subscriptionCanceled, polarSubscriptionDataSchema],
    ["subscriptionPastDue", fixtures.subscriptionPastDue, polarSubscriptionDataSchema],
    ["refundCreated", fixtures.refundCreated, polarRefundDataSchema],
  ] as const)("schema parses %s without throwing", (_name, fixture, schema) => {
    expect(() => schema.parse((fixture as { data: unknown }).data)).not.toThrow();
  });
});

describe("PolarWebhookDispatcher — fixture-driven dispatch", () => {
  it("orderPaidSubscription → ledger.grantSubscriptionCycle with sub.includedCredits", async () => {
    const m = makeMocks();
    m.subSvc.findByPolarId.mockResolvedValue({
      id: "sub_internal_1",
      organizationId: "org_1",
      includedCreditsPerCycle: 1000,
      planSlug: "pro_monthly",
      currentPeriodStart: new Date("2026-04-26T06:19:38.339825Z"),
    });
    const fx = fixtures.orderPaidSubscription as {
      type: string;
      data: Record<string, unknown> & {
        id?: string;
        metadata?: Record<string, string | undefined>;
      };
    };
    const out = await build(m).dispatch(
      { type: fx.type, data: fx.data },
      "evt_fx_op_sub",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.subSvc.findByPolarId).toHaveBeenCalledWith(
      "d88f49da-6f38-4451-be37-2ff6dc1ebf09",
    );
    expect(m.ledger.grantSubscriptionCycle).toHaveBeenCalledTimes(1);
    expect(m.ledger.grantSubscriptionCycle.mock.calls[0]![0]).toMatchObject({
      organizationId: "org_1",
      amount: 1000,
      subscriptionId: "sub_internal_1",
      periodKey: "2026-04-26T06:19:38.339Z",
    });
    expect(m.ledger.grantTopUp).not.toHaveBeenCalled();
    // User receipt notification must use total_amount (gross 1999), NOT
    // amount (post-tax net 1817). See dispatcher comment in handlePaymentSucceeded.
    expect(m.notif.onPaymentSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 1999,
      }),
    );
  });

  it("orderPaidTopup → ledger.grantTopUp with credits from metadata", async () => {
    const m = makeMocks();
    const fx = fixtures.orderPaidTopup as {
      type: string;
      data: Record<string, unknown> & {
        id?: string;
        metadata?: Record<string, string | undefined>;
      };
    };
    const out = await build(m).dispatch(
      { type: fx.type, data: fx.data },
      "evt_fx_op_topup",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.ledger.grantTopUp).toHaveBeenCalledTimes(1);
    expect(m.ledger.grantTopUp.mock.calls[0]![0]).toMatchObject({
      organizationId: "3f146278cd1d4f11ac0d6d53",
      amount: 5000,
      orderId: "00000000-0000-0000-0000-00000000beef",
    });
    expect(m.ledger.grantSubscriptionCycle).not.toHaveBeenCalled();
  });

  // ─── M: payment_orders mirror upsert on order.paid / order.refunded ───
  it("orderPaidSubscription → calls orderMirror.upsertFromOrderPaid with envelope", async () => {
    const m = makeMocks();
    m.subSvc.findByPolarId.mockResolvedValue({
      id: "sub_internal_1",
      organizationId: "org_1",
      includedCreditsPerCycle: 1000,
      planSlug: "pro_monthly",
      currentPeriodStart: new Date("2026-04-26T06:19:38.339825Z"),
    });
    const fx = fixtures.orderPaidSubscription as {
      type: string;
      data: Record<string, unknown> & {
        id?: string;
        metadata?: Record<string, string | undefined>;
      };
    };
    const out = await build(m).dispatch(
      { type: fx.type, data: fx.data },
      "evt_mirror_paid",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.orderMirror.upsertFromOrderPaid).toHaveBeenCalledTimes(1);
    expect(m.orderMirror.upsertFromOrderPaid.mock.calls[0]![0]).toMatchObject({
      type: "order.paid",
      data: { id: "4dc3eddd-64c2-4891-8acb-9c7c6ff16732" },
    });
    expect(m.orderMirror.upsertFromOrderRefunded).not.toHaveBeenCalled();
  });

  it("orderRefunded → calls orderMirror.upsertFromOrderRefunded (mirror-only, no ledger touch)", async () => {
    const m = makeMocks();
    const fx = fixtures.orderRefunded as {
      type: string;
      data: Record<string, unknown> & {
        id?: string;
        metadata?: Record<string, string | undefined>;
      };
    };
    const out = await build(m).dispatch(
      { type: fx.type, data: fx.data },
      "evt_mirror_refunded",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.orderMirror.upsertFromOrderRefunded).toHaveBeenCalledTimes(1);
    expect(m.orderMirror.upsertFromOrderRefunded.mock.calls[0]![0]).toMatchObject({
      type: "order.refunded",
      data: { id: "4dc3eddd-64c2-4891-8acb-9c7c6ff16732" },
    });
    // refund.created handles ledger reversal; order.refunded must NOT.
    expect(m.ledger.refundReverse).not.toHaveBeenCalled();
    expect(m.notif.onRefundCompleted).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────
// N: refund correlation now reads top-level order_id / subscription_id
// from the Polar payload (metadata is often empty). Org id falls back
// to the mirrored payment_orders row when metadata.organization_id is
// absent.
// ────────────────────────────────────────────────────────────────────

describe("PolarWebhookDispatcher — refund top-level correlation [N]", () => {
  it("uses top-level order_id when metadata is empty (org resolved from mirror)", async () => {
    const m = makeMocks();
    m.orderMirror.getOrganizationByPolarOrderId.mockResolvedValue("org_qa_01");
    const fx = fixtures.refundCreated as {
      type: string;
      data: Record<string, unknown> & {
        id?: string;
        metadata?: Record<string, string | undefined>;
      };
    };
    const out = await build(m).dispatch(
      { type: fx.type, data: fx.data },
      "msg_n_1",
    );
    expect(out).toEqual({ result: "ok" });
    expect(m.orderMirror.getOrganizationByPolarOrderId).toHaveBeenCalledWith(
      "4dc3eddd-64c2-4891-8acb-9c7c6ff16732",
    );
    expect(m.ledger.refundReverse).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_qa_01",
        orderId: "4dc3eddd-64c2-4891-8acb-9c7c6ff16732",
        refundId: "00000000-0000-0000-0000-0000refund001",
      }),
    );
  });

  it("falls back to metadata.order_id when top-level absent (legacy payloads)", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "refund.created",
        data: {
          id: "ref_legacy_1",
          status: "succeeded",
          amount: 1999,
          metadata: {
            organization_id: "org_qa_01",
            order_id: "ord_legacy",
          },
        },
      },
      "msg_n_2",
    );
    expect(out).toEqual({ result: "ok" });
    expect(
      m.orderMirror.getOrganizationByPolarOrderId,
    ).not.toHaveBeenCalled();
    expect(m.ledger.refundReverse).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_qa_01",
        orderId: "ord_legacy",
        refundId: "ref_legacy_1",
      }),
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// P: explicit cases for additional Polar event types — completes the
// dispatcher's catalog so unknown types are loud (still hit `default`)
// while every documented Polar event has a named branch.
// ────────────────────────────────────────────────────────────────────

describe("PolarWebhookDispatcher — new event types [P]", () => {
  it("subscription.active → forwards to subscription handler", async () => {
    const m = makeMocks();
    m.subSvc.processEvent.mockResolvedValue({ processed: true });
    const out = await build(m).dispatch(fixtures.subscriptionActive as never, "msg_p_1");
    expect(out.result).toBe("ok");
    expect(m.subSvc.processEvent).toHaveBeenCalled();
  });

  it("subscription.uncanceled → forwards to subscription handler", async () => {
    const m = makeMocks();
    m.subSvc.processEvent.mockResolvedValue({ processed: true });
    const out = await build(m).dispatch(fixtures.subscriptionUncanceled as never, "msg_p_2");
    expect(out.result).toBe("ok");
    expect(m.subSvc.processEvent).toHaveBeenCalled();
  });

  it("subscription.revoked → forwards to subscription handler", async () => {
    const m = makeMocks();
    m.subSvc.processEvent.mockResolvedValue({ processed: true });
    const out = await build(m).dispatch(fixtures.subscriptionRevoked as never, "msg_p_3");
    expect(out.result).toBe("ok");
    expect(m.subSvc.processEvent).toHaveBeenCalled();
  });

  it("subscription.past_due → handleSubscriptionEvent + dunning.markPastDue", async () => {
    const m = makeMocks();
    m.subSvc.processEvent.mockResolvedValue({ processed: true });
    const out = await build(m).dispatch(fixtures.subscriptionPastDue as never, "msg_p_4");
    expect(out.result).toBe("ok");
    expect(m.dunning.markPastDue).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringMatching(/past_due/),
      }),
    );
  });

  it("order.updated → ok no-op (no orderMirror call)", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(fixtures.orderUpdated as never, "msg_p_5");
    expect(out.result).toBe("ok");
    expect(m.orderMirror.upsertFromOrderPaid).not.toHaveBeenCalled();
    expect(m.orderMirror.upsertFromOrderRefunded).not.toHaveBeenCalled();
  });

  it("checkout.expired → ok no-op", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(fixtures.checkoutExpired as never, "msg_p_6");
    expect(out.result).toBe("ok");
  });

  it("benefit_grant.cycled → ok no-op", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(fixtures.benefitGrantCycled as never, "msg_p_7");
    expect(out.result).toBe("ok");
  });

  // F: top-up order.paid with non-numeric `metadata.credits` must surface a
  // diagnostic error (not silently grant 0). The mirror upsert is a no-op for
  // top-up orders (no subscription_id), so dispatch routes to handleOrderCompleted
  // where the tightened credits parse rejects the invalid string.
  it("order.paid (topup) with invalid credits → error [F]", async () => {
    const m = makeMocks();
    const out = await build(m).dispatch(
      {
        type: "order.paid",
        data: {
          id: "ord_topup_bad",
          status: "paid",
          amount: 999,
          total_amount: 999,
          currency: "usd",
          customer_id: "cu_1",
          product_id: "prod_topup",
          metadata: {
            kind: "topup",
            organization_id: "org_qa_01",
            credits: "not-a-number",
          },
        },
      } as never,
      "msg_f_1",
    );
    expect(out.result).toBe("error");
    expect((out as { error: string }).error).toMatch(/credits/);
    expect(m.ledger.grantTopUp).not.toHaveBeenCalled();
  });
});
