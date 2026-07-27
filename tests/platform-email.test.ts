import { describe, expect, it } from "vitest";
import { escapeEmailHtml } from "../src/modules/communication/server/platform-email";

describe("platform email templates", () => {
  it("escapes user-controlled HTML values", () => {
    expect(escapeEmailHtml(`<script>alert("x")</script> & 'test'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#039;test&#039;",
    );
  });
});
