import { createHash } from "node:crypto";
import { paymentInicisEvents, paymentInicisOrders } from "@repo/drizzle";
import { InicisPaymentService } from "./inicis.service";
import { requestApproval, requestNetCancel } from "./src/approval";
import { INICIS_BILLING_BLOCKER } from "./src/billing";
import { buildCancelRequest } from "./src/cancel";
import { INICIS_PAYMENT_CAPABILITIES } from "./src/capabilities";
import { buildPcStdpayCheckout } from "./src/checkout";
import { getInicisConfigStatus, loadInicisConfig } from "./src/config";
import { buildInquiryRequest } from "./src/inquiry";
import { maskEmail, maskName, maskProviderPayload } from "./src/masking";
import {
  createNotiIdempotencyKey,
  INICIS_NOTI_SUCCESS_RESPONSE,
  normalizeNoti,
  parseNotiPayload,
} from "./src/noti";
import type { InicisConfig } from "./src/types";

const cfg: InicisConfig = {
  mode: "test",
  mid: "INIpayTest",
  signKey: "test-sign-key",
  iniApiKey: "test-api-key",
  clientIp: "127.0.0.1",
  returnBaseUrl: "https://example.test",
  notiAllowedIps: ["127.0.0.1"],
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sha512(value: string) {
  return createHash("sha512").update(value).digest("hex");
}

function mockGlobalFetch(...responses: Response[]) {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetchMock,
  });
  return {
    fetchMock,
    restore: () => {
      if (originalFetch) {
        Object.defineProperty(globalThis, "fetch", {
          configurable: true,
          writable: true,
          value: originalFetch,
        });
        return;
      }
      (globalThis as { fetch?: unknown }).fetch = undefined;
    },
  };
}

class FakeInicisDb {
  orders: Record<string, unknown>[] = [];
  events: Record<string, unknown>[] = [];
  failNextEventInsert = false;

  async transaction<T>(callback: (tx: FakeInicisDb) => Promise<T>): Promise<T> {
    const tx = new FakeInicisDb();
    tx.orders = this.orders.map((order) => ({ ...order }));
    tx.events = this.events.map((event) => ({ ...event }));
    tx.failNextEventInsert = this.failNextEventInsert;
    try {
      const result = await callback(tx);
      this.orders = tx.orders;
      this.events = tx.events;
      this.failNextEventInsert = tx.failNextEventInsert;
      return result;
    } catch (error) {
      this.failNextEventInsert = tx.failNextEventInsert;
      throw error;
    }
  }

  insert(table: unknown) {
    return {
      values: (value: Record<string, unknown>) => {
        let inserted: Record<string, unknown> | null = null;
        return {
          // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: fake Drizzle insert chain keeps conflict and rollback semantics in one test double.
          onConflictDoNothing: () => {
            if (table === paymentInicisEvents) {
              if (this.failNextEventInsert) {
                this.failNextEventInsert = false;
                return { returning: () => Promise.reject(new Error("event_insert_failed")) };
              }
              if (!this.events.some((event) => event.idempotencyKey === value.idempotencyKey)) {
                inserted = { id: `event-${this.events.length + 1}`, ...value };
                this.events.push(inserted);
              }
              return { returning: () => Promise.resolve(inserted ? [inserted] : []) };
            }
            if (table === paymentInicisOrders) {
              if (!this.orders.some((order) => order.orderId === value.orderId)) {
                inserted = { id: `order-${this.orders.length + 1}`, ...value };
                this.orders.push(inserted);
              }
            }
            return { returning: () => Promise.resolve(inserted ? [inserted] : []) };
          },
        };
      },
    };
  }

  update(table: unknown) {
    return {
      set: (patch: Record<string, unknown>) => ({
        where: () => {
          if (table === paymentInicisOrders) {
            this.orders = this.orders.map((order) => ({ ...order, ...patch }));
          }
          return Promise.resolve();
        },
      }),
    };
  }

  select() {
    const db = this;
    return {
      from(table: unknown) {
        const rows = table === paymentInicisEvents ? db.events : db.orders;
        return {
          where() {
            return this;
          },
          orderBy() {
            return this;
          },
          limit(n: number) {
            return Promise.resolve(rows.slice(0, n));
          },
        };
      },
    };
  }
}

describe("INICIS reusable provider", () => {
  it("builds PC standard checkout fields with documented hash targets", () => {
    const form = buildPcStdpayCheckout(
      cfg,
      {
        orderId: "oid-1",
        amount: 10000,
        goodsName: "Pro",
        buyerName: "Kim",
        buyerTel: "01012345678",
        buyerEmail: "buyer@example.com",
        payMethod: "Card",
      },
      1_700_000_000_000,
    );

    expect(form.contentType).toBe("application/x-www-form-urlencoded");
    expect(form.fields).toMatchObject({
      gopaymethod: "Card",
      mid: "INIpayTest",
      oid: "oid-1",
      price: "10000",
      timestamp: "1700000000000",
      use_chkfake: "Y",
      goodname: "Pro",
      returnUrl: "https://example.test/api/payment/inicis/return",
      acceptmethod: "centerCd(Y)",
    });
    expect(form.fields.signature).toBe(sha256("oid=oid-1&price=10000&timestamp=1700000000000"));
    expect(form.fields.verification).toBe(
      sha256("oid=oid-1&price=10000&signKey=test-sign-key&timestamp=1700000000000"),
    );
    expect(form.fields.mKey).toBe(sha256("test-sign-key"));
  });

  it("posts netCancel with the documented authToken/timestamp form body", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchMock = (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body ?? "") });
      return Promise.resolve(Response.json({ resultCode: "0000" }));
    };

    await requestNetCancel(
      cfg,
      {
        resultCode: "0000",
        authToken: "auth-token",
        netCancelUrl: "https://fcstdpay.inicis.com/api/netCancel",
        idc_name: "fc",
      },
      fetchMock,
      1_700_000_000_123,
    );

    expect(calls[0]?.url).toBe("https://fcstdpay.inicis.com/api/netCancel");
    const posted = new URLSearchParams(calls[0]?.body);
    expect(posted.get("mid")).toBe("INIpayTest");
    expect(posted.get("signature")).toBe(sha256("authToken=auth-token&timestamp=1700000000123"));
    expect(posted.get("verification")).toBe(
      sha256("authToken=auth-token&signKey=test-sign-key&timestamp=1700000000123"),
    );
    expect(posted.get("charset")).toBe("UTF-8");
    expect(posted.get("format")).toBe("JSON");
  });

  it("posts approval with authToken/timestamp signature and IDC host validation", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchMock = (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body ?? "") });
      return Promise.resolve(
        Response.json({ resultCode: "0000", tid: "tid-1", TotPrice: "10000" }),
      );
    };

    const result = await requestApproval(
      cfg,
      {
        resultCode: "0000",
        authToken: "auth-token",
        authUrl: "https://fcstdpay.inicis.com/api/payAuth",
        idc_name: "fc",
      },
      fetchMock,
      1_700_000_000_123,
    );

    expect(result.tid).toBe("tid-1");
    expect(calls[0]?.url).toBe("https://fcstdpay.inicis.com/api/payAuth");
    const posted = new URLSearchParams(calls[0]?.body);
    expect(posted.get("signature")).toBe(sha256("authToken=auth-token&timestamp=1700000000123"));
    expect(posted.get("verification")).toBe(
      sha256("authToken=auth-token&signKey=test-sign-key&timestamp=1700000000123"),
    );
  });

  it("rejects approval URLs outside INICIS hosts", async () => {
    await expect(
      requestApproval(cfg, {
        resultCode: "0000",
        authToken: "auth-token",
        authUrl: "https://pay.example.test/auth",
      }),
    ).rejects.toThrow("inicis_auth_url_not_allowed");
  });

  it("normalizes PC and mobile noti payloads and returns the documented OK response", () => {
    const pc = normalizeNoti(
      parseNotiPayload({
        no_tid: "tid-pc",
        no_oid: "oid-pc",
        amt_input: "15000",
        ignored: 1,
      }),
    );
    const mobile = normalizeNoti({
      P_STATUS: "02",
      P_TID: "tid-mobile",
      P_OID: "oid-mobile",
      P_AMT: "20000",
      P_NOTI: "merchant-data",
    });

    expect(pc).toMatchObject({
      kind: "pc_vbank_noti",
      orderId: "oid-pc",
      tid: "tid-pc",
      amount: 15000,
      paymentCompleted: true,
    });
    expect(mobile).toMatchObject({
      kind: "mobile_vbank_noti",
      orderId: "oid-mobile",
      tid: "tid-mobile",
      amount: 20000,
      paymentCompleted: true,
    });
    expect(
      createNotiIdempotencyKey({ no_tid: "tid-pc", no_oid: "oid-pc", amt_input: "15000" }),
    ).toHaveLength(64);
    expect(INICIS_NOTI_SUCCESS_RESPONSE).toBe("OK");
  });

  it("builds cancel/refund and inquiry V2 hashes from INIAPIKey + mid + type + timestamp + data", () => {
    const date = new Date("2026-06-13T01:02:03+09:00");
    const cancel = buildCancelRequest(cfg, { tid: "tid-1", reason: "admin" }, date);
    const partial = buildCancelRequest(
      cfg,
      { tid: "tid-1", reason: "admin", amount: 3000, confirmPrice: 7000 },
      date,
    );
    const inquiry = buildInquiryRequest(cfg, { tid: "tid-1" }, date);

    expect(cancel.body.hashData).toBe(
      sha512('test-api-keyINIpayTestrefund20260613010203{"tid":"tid-1","msg":"admin"}'),
    );
    expect(partial.body.hashData).toBe(
      sha512(
        'test-api-keyINIpayTestpartialRefund20260613010203{"tid":"tid-1","price":3000,"confirmPrice":7000,"msg":"admin"}',
      ),
    );
    expect(inquiry.body.hashData).toBe(
      sha512('test-api-keyINIpayTestinquiry20260613010203{"tid":"tid-1"}'),
    );
  });

  it("masks sensitive provider fields before persistence/admin display", () => {
    expect(maskEmail("buyer@example.com")).toBe("bu***@example.com");
    expect(maskName("Kim")).toBe("K*");
    expect(
      maskProviderPayload({
        buyeremail: "buyer@example.com",
        CARD_Num: "1111222233334444",
        hashData: "secret",
        resultCode: "0000",
        resultMsg: "provider message",
      }),
    ).toEqual({
      buyeremail: "bu***@example.com",
      CARD_Num: "***",
      hashData: "***",
      resultCode: "0000",
      resultMsg: "***",
    });
  });

  it("reports config readiness without exposing secret values and keeps billing blocked", () => {
    const env = {
      PAYMENT_INICIS_MODE: "test",
      PAYMENT_INICIS_MID: "mid",
      PAYMENT_INICIS_SIGN_KEY: "sign-key",
      PAYMENT_INICIS_INI_API_KEY: "api-key",
      PAYMENT_INICIS_CLIENT_IP: "127.0.0.1",
      PAYMENT_INICIS_NOTI_ALLOWED_IPS: "203.0.113.10, 203.0.113.11",
      APP_URL: "https://example.test/",
    };
    const loaded = loadInicisConfig(env);
    const status = getInicisConfigStatus(env);

    expect(loaded.returnBaseUrl).toBe("https://example.test");
    expect(status).toMatchObject({
      configured: true,
      midPresent: true,
      signKeyPresent: true,
      iniApiKeyPresent: true,
      notiAllowedIpConfigured: true,
      billingBlocked: true,
    });
    expect(JSON.stringify(status)).not.toContain("sign-key");
    expect(JSON.stringify(status)).not.toContain("203.0.113.10");
    expect(INICIS_BILLING_BLOCKER.code).toBe("inicis_billing_contract_unverified");
  });

  it("reuses an existing checkout only when persisted order fields match", async () => {
    const db = new FakeInicisDb();
    db.orders.push({
      id: "order-1",
      orderId: "oid-reuse",
      userId: "user-1",
      amount: 10000,
      payMethod: "Card",
      goodsName: "Pro",
      status: "pending_auth",
    });
    const service = new InicisPaymentService(db as never, cfg);
    const input = {
      orderId: "oid-reuse",
      amount: 10000,
      goodsName: "Pro",
      buyerName: "Kim",
      buyerTel: "01012345678",
      buyerEmail: "buyer@example.com",
      payMethod: "Card",
    };

    await expect(service.createCheckout(input, "user-1")).resolves.toMatchObject({
      fields: { oid: "oid-reuse", price: "10000", goodname: "Pro" },
    });
    expect(db.events).toHaveLength(0);
    await expect(service.createCheckout({ ...input, amount: 12000 }, "user-1")).rejects.toThrow(
      "결제 요청 정보를 확인해 주세요",
    );
  });

  it("exports Product Builder payment.inicis capability manifest", () => {
    expect(INICIS_PAYMENT_CAPABILITIES.map((capability) => capability.id)).toEqual([
      "payment.inicis.config",
      "payment.inicis.checkout",
      "payment.inicis.approval",
      "payment.inicis.noti",
      "payment.inicis.cancel",
      "payment.inicis.inquiry",
      "payment.inicis.billing.blocker",
      "payment.inicis.vbank-refund.blocker",
      "payment.inicis.admin",
    ]);
  });

  it("persists noti idempotently and marks the matching order paid", async () => {
    const db = new FakeInicisDb();
    db.orders.push({
      id: "order-1",
      orderId: "oid-pc",
      amount: 15000,
      status: "pending_auth",
      tid: null,
    });
    const service = new InicisPaymentService(db as never, cfg);

    await service.handleNoti(
      {
        no_tid: "tid-pc",
        no_oid: "oid-pc",
        amt_input: "15000",
      },
      "127.0.0.1",
    );
    await service.handleNoti(
      {
        no_tid: "tid-pc",
        no_oid: "oid-pc",
        amt_input: "15000",
      },
      "127.0.0.1",
    );

    expect(db.events).toHaveLength(1);
    expect(db.orders[0]).toMatchObject({
      orderId: "oid-pc",
      tid: "tid-pc",
      status: "paid",
      providerResultCode: "",
    });
  });

  it("records failed noti and does not mark paid when source IP allowlist is missing", async () => {
    const db = new FakeInicisDb();
    db.orders.push({
      id: "order-1",
      orderId: "oid-pc",
      amount: 15000,
      status: "pending_auth",
      tid: null,
    });
    const service = new InicisPaymentService(db as never, { ...cfg, notiAllowedIps: [] });

    await expect(
      service.handleNoti(
        {
          no_tid: "tid-pc",
          no_oid: "oid-pc",
          amt_input: "15000",
        },
        "127.0.0.1",
      ),
    ).resolves.toBe("FAIL");

    expect(db.events).toHaveLength(1);
    expect(db.events[0]).toMatchObject({
      status: "failed",
      errorCode: "inicis_noti_ip_allowlist_missing",
    });
    expect(db.orders[0]).toMatchObject({ status: "pending_auth", tid: null });
  });

  it("does not mark an order refunded when INICIS cancel business result fails", async () => {
    const db = new FakeInicisDb();
    db.orders.push({
      id: "order-1",
      orderId: "oid-cancel",
      amount: 10000,
      refundedAmount: 0,
      status: "paid",
      tid: "tid-cancel",
    });
    const { fetchMock, restore } = mockGlobalFetch(
      Response.json({ resultCode: "01", resultMsg: "declined", tid: "tid-cancel" }),
    );
    const service = new InicisPaymentService(db as never, cfg);

    try {
      await expect(service.cancelOrRefund("oid-cancel", { reason: "admin" })).rejects.toThrow(
        "결제 요청을 처리하지 못했습니다",
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(db.orders[0]).toMatchObject({ status: "paid", refundedAmount: 0 });
      expect(db.events[0]).toMatchObject({
        eventType: "cancel_rejected",
        status: "failed",
        errorCode: "inicis_cancel_rejected",
      });
    } finally {
      restore();
    }
  });

  it("rejects partial refunds when amount and confirmPrice do not match the remaining balance", async () => {
    const db = new FakeInicisDb();
    db.orders.push({
      id: "order-1",
      orderId: "oid-partial",
      amount: 10000,
      refundedAmount: 2000,
      status: "paid",
      tid: "tid-partial",
    });
    const service = new InicisPaymentService(db as never, cfg);

    await expect(
      service.cancelOrRefund("oid-partial", {
        reason: "admin",
        amount: 3000,
        confirmPrice: 10000,
      }),
    ).rejects.toThrow("결제 요청 정보를 확인해 주세요");

    expect(db.events).toHaveLength(0);
    expect(db.orders[0]).toMatchObject({ status: "paid", refundedAmount: 2000 });
  });

  it("requests netCancel and keeps approval failed when approved amount differs from the local order", async () => {
    const db = new FakeInicisDb();
    db.orders.push({
      id: "order-1",
      orderId: "oid-return",
      amount: 10000,
      refundedAmount: 0,
      status: "pending_auth",
      tid: null,
    });
    const { fetchMock, restore } = mockGlobalFetch(
      Response.json({
        resultCode: "0000",
        tid: "tid-approved",
        MOID: "oid-return",
        TotPrice: "9000",
      }),
      Response.json({ resultCode: "0000" }),
    );
    const service = new InicisPaymentService(db as never, cfg);

    try {
      await expect(
        service.handleReturn(
          {
            resultCode: "0000",
            mid: "INIpayTest",
            orderNumber: "oid-return",
            authToken: "auth-token",
            authUrl: "https://fcstdpay.inicis.com/api/payAuth",
            netCancelUrl: "https://fcstdpay.inicis.com/api/netCancel",
            idc_name: "fc",
          },
          "127.0.0.1",
        ),
      ).resolves.toMatchObject({
        status: "failed",
        code: "inicis_approval_amount_mismatch",
        orderId: "oid-return",
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(db.orders[0]).toMatchObject({
        status: "failed",
        providerResultCode: "0000",
      });
      expect(db.events[0]).toMatchObject({
        eventType: "approval_validation_failed_net_cancel_requested",
        status: "failed",
        errorCode: "inicis_approval_amount_mismatch",
      });
    } finally {
      restore();
    }
  });

  it("rolls back local approval when approval event persistence fails", async () => {
    const db = new FakeInicisDb();
    db.orders.push({
      id: "order-1",
      orderId: "oid-rollback",
      amount: 10000,
      refundedAmount: 0,
      status: "pending_auth",
      tid: null,
    });
    db.failNextEventInsert = true;
    const { fetchMock, restore } = mockGlobalFetch(
      Response.json({
        resultCode: "0000",
        tid: "tid-approved",
        MOID: "oid-rollback",
        TotPrice: "10000",
      }),
      Response.json({ resultCode: "0000" }),
    );
    const service = new InicisPaymentService(db as never, cfg);

    try {
      await expect(
        service.handleReturn(
          {
            resultCode: "0000",
            mid: "INIpayTest",
            orderNumber: "oid-rollback",
            authToken: "auth-token",
            authUrl: "https://fcstdpay.inicis.com/api/payAuth",
            netCancelUrl: "https://fcstdpay.inicis.com/api/netCancel",
            idc_name: "fc",
          },
          "127.0.0.1",
        ),
      ).resolves.toMatchObject({
        status: "failed",
        code: "approval_failed",
        orderId: "oid-rollback",
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(db.orders[0]).toMatchObject({
        status: "pending_auth",
        tid: null,
      });
      expect(db.events[0]).toMatchObject({
        eventType: "approval_failed_net_cancel_requested",
        status: "failed",
      });
    } finally {
      restore();
    }
  });

  it("records separate events for repeated same-amount partial refunds", async () => {
    const db = new FakeInicisDb();
    db.orders.push({
      id: "order-1",
      orderId: "oid-repeat-refund",
      amount: 10000,
      refundedAmount: 0,
      status: "paid",
      tid: "tid-repeat-refund",
    });
    const { restore } = mockGlobalFetch(
      Response.json({ resultCode: "00", resultMsg: "ok", tid: "tid-repeat-refund" }),
      Response.json({ resultCode: "00", resultMsg: "ok", tid: "tid-repeat-refund" }),
    );
    const service = new InicisPaymentService(db as never, cfg);

    try {
      await service.cancelOrRefund("oid-repeat-refund", {
        reason: "admin",
        amount: 3000,
        confirmPrice: 7000,
      });
      await service.cancelOrRefund("oid-repeat-refund", {
        reason: "admin",
        amount: 3000,
        confirmPrice: 4000,
      });

      expect(db.orders[0]).toMatchObject({
        status: "partially_refunded",
        refundedAmount: 6000,
      });
      expect(
        db.events.filter((event) => event.eventType === "partial_refund_requested"),
      ).toHaveLength(2);
    } finally {
      restore();
    }
  });

  it("returns masked order detail with event timeline and explicit entitlement blocker", async () => {
    const db = new FakeInicisDb();
    db.orders.push({
      id: "order-1",
      orderId: "oid-detail",
      amount: 10000,
      status: "paid",
      tid: "tid-detail",
      rawMasked: { CARD_Num: "***" },
    });
    db.events.push({
      id: "event-1",
      orderId: "oid-detail",
      tid: "tid-detail",
      eventType: "approval_succeeded",
      status: "processed",
      idempotencyKey: "key-1",
      rawMasked: { CARD_Num: "***" },
      createdAt: new Date("2026-06-13T00:00:00Z"),
    });
    const service = new InicisPaymentService(db as never, null);

    await expect(service.getOrderDetail("oid-detail")).resolves.toMatchObject({
      order: { orderId: "oid-detail", rawMasked: { CARD_Num: "***" } },
      events: [{ eventType: "approval_succeeded", rawMasked: { CARD_Num: "***" } }],
      entitlementStatus: {
        status: "blocked",
        code: "inicis_entitlement_adapter_required",
      },
    });
  });
});
