import { describe, expect, it } from "vitest";
import { renderEmail } from "../../../src/email/email-template.js";
import { buildPasswordResetUrl, buildVerificationUrl } from "../../../src/email/email-links.js";

describe("transactional email layout", () => {
  it("escapes untrusted content and provides a text version and fallback link", () => {
    const result = renderEmail({
      eyebrow: "Account security",
      title: '<script>alert("test")</script>',
      body: "An update at A & B",
      buttonLabel: "Open account",
      buttonUrl: "https://example.test/reset?token=abc&source=email",
      note: "Ignore if unexpected.",
    });
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("token=abc&amp;source=email");
    expect(result.html).toContain('role="presentation"');
    expect(result.html).toContain("If the button does not work");
    expect(result.text).toContain("https://example.test/reset?token=abc&source=email");
  });
  it("builds frontend verification and reset links with encoded tokens", () => {
    for (const [build, path] of [
      [buildVerificationUrl, "/verify-email"],
      [buildPasswordResetUrl, "/reset-password"],
    ] as const) {
      const url = new URL(build("token+/=&"));
      expect(url.pathname).toBe(path);
      expect(url.searchParams.get("token")).toBe("token+/=&");
    }
  });
});
