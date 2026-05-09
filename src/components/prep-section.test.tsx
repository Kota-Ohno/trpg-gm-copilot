import { renderToString } from "react-dom/server";
import { NotebookPen } from "lucide-react";
import { describe, expect, it } from "vitest";
import { PrepSection } from "./prep-section";

describe("PrepSection", () => {
  it("renders an illustrated empty state when no prep items exist", () => {
    const html = renderToString(<PrepSection icon={NotebookPen} items={[]} title="次回準備" />);

    expect(html).toContain("生成された準備項目はありません");
    expect(html).toContain("ログの候補を承認してキャンペーン記憶を増やすと");
    expect(html).toContain("次回準備なしを表す、承認済み記憶を待つ空の経路ボード");
  });

  it("does not render the illustrated empty state when prep items exist", () => {
    const html = renderToString(<PrepSection icon={NotebookPen} items={["導入シーンを準備する"]} title="次回準備" />);

    expect(html).toContain("導入シーンを準備する");
    expect(html).not.toContain("生成された準備項目はありません");
    expect(html).not.toContain("次回準備なしを表す、承認済み記憶を待つ空の経路ボード");
  });
});
