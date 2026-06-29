import assert from "node:assert/strict";
import { test } from "node:test";
import {
  injectAuthOrganizationInvitationSender,
  resetAuthOrganizationInvitationSenderForTests,
  sendAuthOrganizationInvitationEmail,
} from "./organization-invitation-sender";

test("delegates auth organization invitation emails to the injected sender", async () => {
  resetAuthOrganizationInvitationSenderForTests();
  const calls: unknown[] = [];

  injectAuthOrganizationInvitationSender({
    sendOrganizationInvitationEmail: (input) => {
      calls.push(input);
      return Promise.resolve();
    },
  });

  const input = {
    id: "invitation-1",
    email: "teammate@studio.com",
    role: "member",
    organization: {
      id: "org-1",
      name: "Aethys Saga",
      slug: "aethys-saga",
    },
    inviter: {
      user: {
        id: "user-1",
        email: "owner@studio.com",
        name: "Jane Writer",
      },
    },
    invitation: { id: "invitation-1" },
    request: {
      url: "http://localhost:3002/api/auth/organization/invite-member",
      headers: {
        get: (name: string) => (name.toLowerCase() === "origin" ? "http://localhost:3000" : null),
      },
    },
  };

  await sendAuthOrganizationInvitationEmail(input);

  assert.deepEqual(calls, [input]);
});

test("throws in production when the organization invitation sender is not injected", async () => {
  resetAuthOrganizationInvitationSenderForTests();
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  await assert.rejects(
    () =>
      sendAuthOrganizationInvitationEmail({
        id: "invitation-1",
        email: "teammate@studio.com",
        role: "member",
        organization: { id: "org-1", name: "Aethys Saga" },
        inviter: { user: { id: "user-1", email: "owner@studio.com" } },
        invitation: { id: "invitation-1" },
      }),
    /Auth organization invitation sender is not initialized/,
  );

  if (originalEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalEnv;
  }
});
