import type { LucideIcon } from "lucide-react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

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
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            生成された準備項目はありません。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
