import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProviderSettingsCard } from "./provider-settings-card";

describe("ProviderSettingsCard", () => {
  it("shows that OpenAI API keys are session-only and not persisted", () => {
    const html = renderToString(
      <ProviderSettingsCard
        isLocked={false}
        secrets={{ openAiApiKey: "" }}
        settings={{ providerId: "openai", model: "gpt-4.1-mini", endpoint: "https://api.openai.com/v1" }}
        onChange={vi.fn()}
        onChangeSecrets={vi.fn()}
      />,
    );

    expect(html).toContain("保存しない");
    expect(html).toContain("このタブのみ");
    expect(html).toContain("security-boundary-note");
    expect(html).toContain("ブラウザ保存、キャンペーンJSON、診断JSONには含めません");
    expect(html).toContain("リロードで消えます");
  });
});
