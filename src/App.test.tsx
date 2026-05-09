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

    expect(html).toContain('aria-label="公開入口"');
    expect(html).toContain("5分で試す");
    expect(html).toContain("ワークベンチへ");
    expect(html).toContain("灯台サンプル");
    expect(html).toContain("実ログから始める");
    expect(html).not.toContain("即応パレット");
  });

  it("renders core product workflows and continuity surfaces", () => {
    const html = renderToString(<App />);

    expect(html).toContain("つぎたく");
    expect(html).toContain("テンプレート");
    expect(html).toContain("調査サンプル");
    expect(html).toContain("ファンタジー雛形");
    expect(html).toContain("次回までの確認キュー");
    expect(html).toContain("次にやること");
    expect(html).toContain("即応パレット");
    expect(html).toContain("次回準備");
    expect(html).toContain("公開入口");
    expect(html).toContain('aria-label="キャンペーンとセッション"');
    expect(html).toContain('aria-label="サイドデスク"');
  });

  it("renders session navigation landmarks from persisted UI preferences", () => {
    stubLocalStorage({
      "chronicle-gm.ui-preferences.v1": JSON.stringify({
        activeTab: "home",
        navigationPanelMode: "sessions",
      }),
    });

    const html = renderToString(<App />);

    expect(html).toContain('aria-label="キャンペーンとセッション"');
    expect(html).toContain('aria-label="記憶ナビ"');
  });

  it("renders operational check surfaces from persisted UI preferences", () => {
    stubLocalStorage({
      "chronicle-gm.ui-preferences.v1": JSON.stringify({
        activeTab: "home",
        rightPanelMode: "settings",
        settingsPanelMode: "roadmap",
      }),
    });

    const html = renderToString(<App />);

    expect(html).toContain("運用");
    expect(html).toContain("信頼性チェック");
    expect(html).toContain("APIキー保護");
    expect(html).toContain("表示/導線確認");
    expect(html).not.toContain(["証", "跡"].join(""));
    expect(html).not.toContain("出荷");
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
