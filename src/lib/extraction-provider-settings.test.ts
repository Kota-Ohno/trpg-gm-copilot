import { describe, expect, it } from "vitest";
import {
  defaultProviderSecretSettings,
  getExtractionProvider,
  getTranscriptionProvider,
  normalizeProviderSecretSettings,
} from "./extraction-provider-settings";

describe("provider definitions", () => {
  it("falls back to default providers for unknown ids", () => {
    expect(getExtractionProvider("missing" as never).id).toBe("rule-based");
    expect(getTranscriptionProvider("missing" as never).id).toBe("manual");
  });
});

describe("normalizeProviderSecretSettings", () => {
  it("trims OpenAI API keys and falls back for invalid input", () => {
    expect(normalizeProviderSecretSettings({ openAiApiKey: "  sk-test  " })).toEqual({
      openAiApiKey: "sk-test",
    });
    expect(normalizeProviderSecretSettings(null)).toEqual(defaultProviderSecretSettings);
    expect(normalizeProviderSecretSettings({ openAiApiKey: 123 })).toEqual(defaultProviderSecretSettings);
  });
});
