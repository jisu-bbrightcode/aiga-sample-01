import { mapResendEvent, resolveStatusUpdate } from "./resend-event-mapper";
import type { ResendWebhookPayload } from "./resend.payload.schema";

function event(type: string, data: Record<string, unknown> = {}): ResendWebhookPayload {
  return { type, data: { email_id: "email_1", ...data } } as ResendWebhookPayload;
}

describe("mapResendEvent", () => {
  it("maps delivered → delivered + deliveredAt", () => {
    expect(mapResendEvent(event("email.delivered"))).toEqual({
      emailId: "email_1",
      eventType: "email.delivered",
      desiredStatus: "delivered",
      setDeliveredAt: true,
    });
  });

  it("maps opened → opened + openedAt", () => {
    expect(mapResendEvent(event("email.opened"))).toEqual({
      emailId: "email_1",
      eventType: "email.opened",
      desiredStatus: "opened",
      setOpenedAt: true,
    });
  });

  it("maps bounced with detailed reason", () => {
    const result = mapResendEvent(
      event("email.bounced", {
        bounce: { type: "Permanent", subType: "General", message: "mailbox does not exist" },
      }),
    );
    expect(result).toEqual({
      emailId: "email_1",
      eventType: "email.bounced",
      desiredStatus: "bounced",
      failureReason: "bounce: Permanent: General: mailbox does not exist",
    });
  });

  it("maps complaint → bounced with explicit reason (no complained enum)", () => {
    expect(mapResendEvent(event("email.complained"))).toEqual({
      emailId: "email_1",
      eventType: "email.complained",
      desiredStatus: "bounced",
      failureReason: "spam complaint (email.complained)",
    });
  });

  it("ignores email.clicked and delivery_delayed", () => {
    expect(mapResendEvent(event("email.clicked"))).toBeNull();
    expect(mapResendEvent(event("email.delivery_delayed"))).toBeNull();
  });

  it("returns null when email_id is missing", () => {
    expect(mapResendEvent({ type: "email.delivered", data: {} } as ResendWebhookPayload)).toBeNull();
  });
});

describe("resolveStatusUpdate (no regression)", () => {
  it("advances to a higher-priority status", () => {
    expect(resolveStatusUpdate("sent", "delivered")).toBe("delivered");
    expect(resolveStatusUpdate("delivered", "opened")).toBe("opened");
    expect(resolveStatusUpdate("sent", "bounced")).toBe("bounced");
  });

  it("does not downgrade a terminal status", () => {
    expect(resolveStatusUpdate("bounced", "opened")).toBeUndefined();
    expect(resolveStatusUpdate("bounced", "delivered")).toBeUndefined();
    expect(resolveStatusUpdate("opened", "delivered")).toBeUndefined();
  });

  it("returns undefined when there is no desired status", () => {
    expect(resolveStatusUpdate("sent", undefined)).toBeUndefined();
  });
});
