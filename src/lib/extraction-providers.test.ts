import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLlmExtractionResult, testExtractionProviderConnection } from "./extraction-providers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("testExtractionProviderConnection", () => {
  it("reports rule based provider as locally ready", async () => {
    await expect(testExtractionProviderConnection({
      secrets: { openAiApiKey: "" },
      settings: { providerId: "rule-based", model: "local-rules-v1", endpoint: "" },
    })).resolves.toEqual({
      isReleaseQaEvidence: false,
      ok: true,
      message: "ルールベースProviderはローカルで利用できます。model: local-rules-v1",
    });
  });

  it("rejects OpenAI connection tests before network calls when the API key is missing", async () => {
    await expect(testExtractionProviderConnection({
      secrets: { openAiApiKey: "  " },
      settings: { providerId: "openai", model: "", endpoint: "https://api.openai.com/v1" },
    })).resolves.toEqual({
      isReleaseQaEvidence: false,
      ok: false,
      message: "OpenAI API key が未入力です。model: gpt-4.1-mini",
    });
  });

  it("marks successful OpenAI connection tests as release QA evidence", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      output_text: "{\"ok\": true}",
    }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      clearTimeout: globalThis.clearTimeout,
      setTimeout: globalThis.setTimeout,
    });

    await expect(testExtractionProviderConnection({
      secrets: { openAiApiKey: "sk-test" },
      settings: { providerId: "openai", model: "gpt-4.1-mini", endpoint: "https://api.openai.com/v1/" },
    })).resolves.toEqual({
      isReleaseQaEvidence: true,
      ok: true,
      message: "OpenAI Provider に接続できました。model: gpt-4.1-mini",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
        method: "POST",
      }),
    );
  });

  it("marks successful Ollama connection tests as release QA evidence", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      response: "{\"ok\": true}",
    }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      clearTimeout: globalThis.clearTimeout,
      setTimeout: globalThis.setTimeout,
    });

    await expect(testExtractionProviderConnection({
      secrets: { openAiApiKey: "" },
      settings: { providerId: "ollama", model: "llama3.1", endpoint: "http://localhost:11434/" },
    })).resolves.toEqual({
      isReleaseQaEvidence: true,
      ok: true,
      message: "Ollama Provider に接続できました。model: llama3.1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/generate",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});

describe("buildLlmExtractionResult", () => {
  it("normalizes provider JSON and records extraction run metadata", () => {
    const result = buildLlmExtractionResult(JSON.stringify({
      items: [
        {
          id: "item-1",
          kind: "手がかり",
          title: "古い鍵",
          detail: "倉庫で見つかった",
          visibility: "PL既知",
        },
      ],
    }), {
      campaignMode: "investigation",
      log: "GM: 古い鍵を見つける",
      liveLog: {
        id: "live-log-1",
        title: "ログ",
        sourceType: "manual",
        speakers: [{ id: "speaker-gm", name: "GM", role: "GM" }],
        segments: [],
      },
      secrets: { openAiApiKey: "sk-test" },
      settings: { providerId: "openai", model: "gpt-4.1-mini", endpoint: "https://api.openai.com/v1" },
      source: "plain",
    });

    expect(result.items).toEqual([
      {
        id: "item-1",
        kind: "手がかり",
        title: "古い鍵",
        detail: "倉庫で見つかった",
        visibility: "PL既知",
      },
    ]);
    expect(result.run).toMatchObject({
      campaignMode: "investigation",
      sourceType: "plain",
      providerId: "openai",
      providerLabel: "OpenAI",
      executedProviderId: "openai",
      executedProviderLabel: "OpenAI",
      fallbackUsed: false,
      itemCount: 1,
      promptVersion: "extraction-v1",
    });
    expect(result.run.promptLength).toBeGreaterThan(0);
    expect(result.run.validationErrors).toBeUndefined();
  });
});
