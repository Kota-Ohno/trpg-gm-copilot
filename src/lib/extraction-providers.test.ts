import { describe, expect, it } from "vitest";
import { testExtractionProviderConnection } from "./extraction-providers";

describe("testExtractionProviderConnection", () => {
  it("reports rule based provider as locally ready", async () => {
    await expect(testExtractionProviderConnection({
      secrets: { openAiApiKey: "" },
      settings: { providerId: "rule-based", model: "local-rules-v1", endpoint: "" },
    })).resolves.toEqual({
      ok: true,
      message: "ルールベースProviderはローカルで利用できます。model: local-rules-v1",
    });
  });

  it("rejects OpenAI connection tests before network calls when the API key is missing", async () => {
    await expect(testExtractionProviderConnection({
      secrets: { openAiApiKey: "  " },
      settings: { providerId: "openai", model: "", endpoint: "https://api.openai.com/v1" },
    })).resolves.toEqual({
      ok: false,
      message: "OpenAI API key が未入力です。model: gpt-4.1-mini",
    });
  });
});
