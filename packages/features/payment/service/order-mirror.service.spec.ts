/**
 * OrderMirrorService — pure unit tests with a mocked DrizzleDB chain.
 *
 * Spec §3.2 item M: keeps payment_orders in sync with Polar order events.
 * No real DB — we assert the upsert/update calls (target, set, where) plus
 * the SubscriptionService.findByPolarId interaction.
 */
import { OrderMirrorService } from "./order-mirror.service";
import type { SubscriptionService } from "./subscription.service";
import type { DrizzleDB } from "@repo/drizzle";

import orderPaidSubscription from "../__fixtures__/polar/order-paid-subscription.json";
import orderRefunded from "../__fixtures__/polar/order-refunded.json";

interface DbMock {
  insert: jest.Mock;
  values: jest.Mock;
  onConflictDoUpdate: jest.Mock;
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  select: jest.Mock;
  from: jest.Mock;
  selectWhere: jest.Mock;
  limit: jest.Mock;
}

function makeDbMock(selectRows: unknown[] = []): DbMock {
  const onConflictDoUpdate = jest.fn().mockResolvedValue([]);
  const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = jest.fn().mockReturnValue({ values });
  const where = jest.fn().mockResolvedValue([]);
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  // select chain: select().from().where().limit()
  const limit = jest.fn().mockResolvedValue(selectRows);
  const selectWhere = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from });
  return {
    insert,
    values,
    onConflictDoUpdate,
    update,
    set,
    where,
    select,
    from,
    selectWhere,
    limit,
  };
}

function makeSubSvcMock(): { findByPolarId: jest.Mock } {
  return { findByPolarId: jest.fn() };
}

function build(
  db: DbMock,
  sub: { findByPolarId: jest.Mock },
): OrderMirrorService {
  return new OrderMirrorService(
    db as unknown as DrizzleDB,
    sub as unknown as SubscriptionService,
  );
}

describe("OrderMirrorService", () => {
  describe("upsertFromOrderPaid", () => {
    it("inserts a new payment_orders row keyed by polarOrderId with status=paid + amountCents from total_amount", async () => {
      const db = makeDbMock();
      const sub = makeSubSvcMock();
      sub.findByPolarId.mockResolvedValue({ id: "sub_internal_1" });
      const svc = build(db, sub);

      await svc.upsertFromOrderPaid(orderPaidSubscription as never);

      // findByPolarId looked up the polar subscription_id
      expect(sub.findByPolarId).toHaveBeenCalledWith(
        "d88f49da-6f38-4451-be37-2ff6dc1ebf09",
      );

      // db.insert called and values include the mirrored fields.
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db.values).toHaveBeenCalledTimes(1);
      const row = db.values.mock.calls[0]![0];
      expect(row).toMatchObject({
        polarOrderId: "4dc3eddd-64c2-4891-8acb-9c7c6ff16732",
        organizationId: "3f146278cd1d4f11ac0d6d53",
        userId: "2giwb3yBmUZwB1CBMF9VXcvxAw8bRYCK",
        subscriptionId: "sub_internal_1",
        // total_amount = 1999 (gross charged), NOT amount/net_amount.
        amountCents: 1999,
        currency: "USD",
        status: "paid",
        refundedAmountCents: 0,
      });

      // Idempotent: onConflictDoUpdate uses the unique polar_order_id.
      expect(db.onConflictDoUpdate).toHaveBeenCalledTimes(1);
      const conflict = db.onConflictDoUpdate.mock.calls[0]![0];
      expect(conflict.target).toBeDefined();
      expect(conflict.set).toMatchObject({
        status: "paid",
        amountCents: 1999,
        currency: "USD",
      });
    });

    it("skips silently when subscriptionId can't be resolved (INV-7 protection, top-up package lookup deferred)", async () => {
      const db = makeDbMock();
      const sub = makeSubSvcMock();
      sub.findByPolarId.mockResolvedValue(null);
      const svc = build(db, sub);

      await svc.upsertFromOrderPaid(orderPaidSubscription as never);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it("skips silently when org/user metadata is absent (forward-compat with manual Polar dashboard orders)", async () => {
      const db = makeDbMock();
      const sub = makeSubSvcMock();
      const svc = build(db, sub);

      await svc.upsertFromOrderPaid({
        type: "order.paid",
        data: {
          id: "ord_no_meta",
          status: "paid",
          amount: 1817,
          total_amount: 1999,
          currency: "usd",
          customer_id: "cust_x",
          product_id: "prod_x",
          metadata: {},
        },
      } as never);

      expect(db.insert).not.toHaveBeenCalled();
      expect(sub.findByPolarId).not.toHaveBeenCalled();
    });
  });

  describe("upsertFromOrderRefunded", () => {
    it("updates the existing row's status and refundedAmountCents", async () => {
      const db = makeDbMock();
      const sub = makeSubSvcMock();
      const svc = build(db, sub);

      await svc.upsertFromOrderRefunded(orderRefunded as never);

      expect(db.update).toHaveBeenCalledTimes(1);
      expect(db.set).toHaveBeenCalledTimes(1);
      const setArg = db.set.mock.calls[0]![0];
      expect(setArg).toMatchObject({
        status: "refunded",
        refundedAmountCents: 1999,
      });
      expect(db.where).toHaveBeenCalledTimes(1);
    });
  });

  describe("getOrganizationByPolarOrderId [N]", () => {
    it("returns the organization id when a row exists", async () => {
      const db = makeDbMock([{ organizationId: "org_qa_01" }]);
      const sub = makeSubSvcMock();
      const svc = build(db, sub);

      const result = await svc.getOrganizationByPolarOrderId("ord_x");

      expect(result).toBe("org_qa_01");
      expect(db.select).toHaveBeenCalledTimes(1);
      expect(db.from).toHaveBeenCalledTimes(1);
      expect(db.selectWhere).toHaveBeenCalledTimes(1);
      expect(db.limit).toHaveBeenCalledWith(1);
    });

    it("returns undefined when no row matches", async () => {
      const db = makeDbMock([]);
      const sub = makeSubSvcMock();
      const svc = build(db, sub);

      const result = await svc.getOrganizationByPolarOrderId("ord_missing");

      expect(result).toBeUndefined();
    });
  });
});
