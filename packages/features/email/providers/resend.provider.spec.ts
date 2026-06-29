import { ResendProvider } from "./resend.provider";

describe("ResendProvider", () => {
  const originalApiKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalApiKey;
    }
  });

  it("does not require RESEND_API_KEY at construction time", () => {
    delete process.env.RESEND_API_KEY;

    expect(() => new ResendProvider()).not.toThrow();
  });

  it("requires RESEND_API_KEY when sending", async () => {
    delete process.env.RESEND_API_KEY;
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = new ResendProvider();

    try {
      await expect(
        provider.send({
          to: "user@example.com",
          subject: "Hello",
          html: "<p>Hello</p>",
        }),
      ).rejects.toThrow(/RESEND_API_KEY/);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
