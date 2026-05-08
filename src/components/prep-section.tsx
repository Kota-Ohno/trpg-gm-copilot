import type { LucideIcon } from "lucide-react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import emptyNoPrepImage from "../assets/public-release/empty-no-prep.jpg";

type PrepSectionProps = {
  title: string;
  items: string[];
  icon: LucideIcon;
};

export function PrepSection({ title, items, icon: Icon }: PrepSectionProps) {
  const visibleItems = items.map((item) => item.trim()).filter(Boolean);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <Badge variant="muted">{visibleItems.length}件</Badge>
      </CardHeader>
      <CardContent>
        {visibleItems.length > 0 ? (
          <ol className="space-y-2">
            {visibleItems.map((item, index) => (
              <li
                className="flex gap-3 rounded-md border bg-background px-3 py-2 text-sm leading-6"
                key={`${index}-${item}`}
              >
                <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-sm bg-muted text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="illustrated-empty-state rounded-md border border-dashed bg-background/82 p-4">
            <img
              alt="次回準備なしを表す、承認済み記憶を待つ空の経路ボードと三つのルートマーカーのイラスト。"
              className="h-24 w-24 rounded-md object-cover shadow-sm"
              src={emptyNoPrepImage}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">生成された準備項目はありません</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                ログの候補を承認してキャンペーン記憶を増やすと、この準備欄に次回用の材料が入ります。
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
