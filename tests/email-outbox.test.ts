import { describe, expect, it } from "vitest";
import { retryDelayMilliseconds } from "@/modules/communication/server/email-outbox";

describe("email outbox retry schedule", () => {
  it("uses bounded exponential delays", () => {
    expect(retryDelayMilliseconds(1)).toBe(30_000);
    expect(retryDelayMilliseconds(2)).toBe(60_000);
    expect(retryDelayMilliseconds(3)).toBe(120_000);
    expect(retryDelayMilliseconds(20)).toBe(3_600_000);
  });
});
