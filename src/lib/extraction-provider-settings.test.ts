import { describe, expect, it } from "vitest";
import {
  getExtractionProvider,
  getTranscriptionProvider,
} from "./extraction-provider-settings";

describe("provider definitions", () => {
  it("falls back to default providers for unknown ids", () => {
    expect(getExtractionProvider("missing" as never).id).toBe("rule-based");
    expect(getTranscriptionProvider("missing" as never).id).toBe("manual");
  });
});
