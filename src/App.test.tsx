import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubLocalStorage(values: Record<string, string>): void {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values[key] ?? null,
      removeItem: vi.fn(),
      setItem: vi.fn(),
    },
  });
}

describe("App smoke render", () => {
  it("renders the public entry for a fresh browser profile", () => {
    stubLocalStorage({});

    const html = renderToString(<App />);

    expect(html).toContain("5分で試す");
    expect(html).toContain("ワークベンチへ");
    expect(html).toContain("灯台サンプル");
    expect(html).toContain("実ログから始める");
    expect(html).not.toContain("即応パレット");
  });

  it("renders core product workflows and continuity surfaces", () => {
    const html = renderToString(<App />);

    expect(html).toContain("Loreline");
    expect(html).toContain("テンプレート");
    expect(html).toContain("調査サンプル");
    expect(html).toContain("ファンタジー雛形");
    expect(html).toContain("次回までの確認キュー");
    expect(html).toContain("Release QA");
    expect(html).toContain("次にやること");
    expect(html).toContain("即応パレット");
    expect(html).toContain("次回準備");
    expect(html).toContain("公開入口");
  });

  it("renders operational QA evidence surfaces from persisted UI preferences", () => {
    stubLocalStorage({
      "chronicle-gm.ui-preferences.v1": JSON.stringify({
        activeTab: "home",
        rightPanelMode: "settings",
        settingsPanelMode: "roadmap",
      }),
    });

    const html = renderToString(<App />);

    expect(html).toContain("運用QA");
    expect(html).toContain("Release QA");
    expect(html).toContain("確認メモ");
    expect(html).toContain("証跡なし");
    expect(html).toContain("出荷未完了");
    expect(html).toContain("不足 確認");
    expect(html).toContain("確認済み");
    expect(html).toContain("リセット");
    expect(html).toContain("抽出Provider実地確認");
    expect(html).toContain("文字起こしProvider実地確認");
  });

  it("keeps legacy provider release QA evidence visible after provider QA split", () => {
    stubLocalStorage({
      "chronicle-gm.release-qa-completed.v1": JSON.stringify(["provider-live-check"]),
      "chronicle-gm.release-qa-evidence.v1": JSON.stringify({
        "provider-live-check": "2026-05-05T00:00:00.000Z 抽出/OpenAI: 成功 - model found; 2026-05-05T00:01:00.000Z 文字起こし/OpenAI: 成功 - model found",
      }),
      "chronicle-gm.ui-preferences.v1": JSON.stringify({
        activeTab: "home",
        rightPanelMode: "settings",
        settingsPanelMode: "roadmap",
      }),
    });

    const html = renderToString(<App />);

    expect(html).toContain("抽出/OpenAI: 成功");
    expect(html).toContain("文字起こし/OpenAI: 成功");
    expect(html).toContain("0/11件のRelease QAを確認済み");
    expect(html).toContain("証跡 2件");
  });

  it("renders transcription provider connection testing from persisted UI preferences", () => {
    stubLocalStorage({
      "chronicle-gm.ui-preferences.v1": JSON.stringify({
        activeTab: "home",
        rightPanelMode: "settings",
        settingsPanelMode: "transcription",
      }),
    });

    const html = renderToString(<App />);

    expect(html).toContain("文字起こしProvider");
    expect(html).toContain("接続テスト");
    expect(html).toContain("準備OK");
  });
});
