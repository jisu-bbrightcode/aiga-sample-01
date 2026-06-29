import { NotFoundException } from "@nestjs/common";
import { InicisAdminController } from "./inicis.controller";

describe("InicisAdminController", () => {
  const user = { id: "admin-user" } as never;
  const req = {
    ip: "127.0.0.1",
    headers: { "user-agent": "jest" },
  };

  it("records an audit row for admin cancel mutations", async () => {
    const inicis = {
      cancelOrRefund: jest.fn().mockResolvedValue({ resultCode: "00", tid: "tid-1" }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const controller = new InicisAdminController(inicis as never, audit as never);

    await expect(
      controller.cancel("order-1", { reason: "customer_request" }, user, req),
    ).resolves.toEqual({ resultCode: "00", tid: "tid-1" });

    expect(inicis.cancelOrRefund).toHaveBeenCalledWith("order-1", {
      orderId: "order-1",
      reason: "customer_request",
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-user",
        action: "inicis_cancel",
        reason: "customer_request",
        ipAddress: "127.0.0.1",
        userAgent: "jest",
        payloadBefore: { orderId: "order-1", reason: "customer_request" },
        payloadAfter: { resultCode: "00", tid: "tid-1" },
      }),
    );
  });

  it("records an audit row for admin replay mutations", async () => {
    const inicis = {
      replayEvent: jest.fn().mockResolvedValue({ ok: true, eventId: "event-1" }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const controller = new InicisAdminController(inicis as never, audit as never);

    await expect(controller.replay("event-1", user, req)).resolves.toEqual({
      ok: true,
      eventId: "event-1",
    });

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-user",
        action: "inicis_replay",
        reason: "admin_replay",
        payloadBefore: { eventId: "event-1", reason: "admin_replay" },
      }),
    );
  });

  it("throws NotFoundException when INICIS order detail is missing", async () => {
    const inicis = { getOrderDetail: jest.fn().mockResolvedValue(null) };
    const audit = { log: jest.fn() };
    const controller = new InicisAdminController(inicis as never, audit as never);

    await expect(controller.getOrderDetail("missing-order")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
