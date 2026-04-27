import { Check, X } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import type { ExtractionItem } from "../types";

const extractionKindOptions: ExtractionItem["kind"][] = ["出来事", "NPC", "手がかり", "GM秘密", "伏線"];
const extractionVisibilityOptions: ExtractionItem["visibility"][] = ["PL既知", "GMのみ", "未開示候補"];

type ExtractionReviewCardProps = {
  isApproved: boolean;
  item: ExtractionItem;
  onApprove: (item: ExtractionItem) => void;
  onReject: (itemId: string) => void;
  onUpdate: (itemId: string, updates: Partial<ExtractionItem>) => void;
};

export function ExtractionReviewCard({
  isApproved,
  item,
  onApprove,
  onReject,
  onUpdate,
}: ExtractionReviewCardProps) {
  const canApprove = item.title.trim().length > 0 && item.detail.trim().length > 0;
  const missingFields = [
    !item.title.trim() ? "タイトル" : "",
    !item.detail.trim() ? "本文" : "",
  ].filter(Boolean);
  const detailLength = item.detail.trim().length;
  const cardStateClass = isApproved
    ? "border-primary/40 bg-primary/5"
    : !canApprove
      ? "border-destructive/30 bg-destructive/5"
      : "";

  return (
    <Card className={cardStateClass}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge>{item.kind}</Badge>
              <Badge variant={item.visibility === "GMのみ" ? "secondary" : "outline"}>{item.visibility}</Badge>
              <Badge variant="outline">本文 {detailLength}字</Badge>
              {isApproved && <Badge variant="muted">採用済み</Badge>}
              {!canApprove && (
                <Badge variant="destructive">未入力あり</Badge>
              )}
            </div>
            <CardTitle>{item.title || "無題の抽出候補"}</CardTitle>
            <CardDescription className="mt-2 leading-6">
              GMが確認して、必要なら直してから採用します。
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              aria-label="採用"
              disabled={isApproved || !canApprove}
              onClick={() => onApprove(item)}
              size="icon"
              title={canApprove ? "この候補を採用" : `採用には${missingFields.join("・")}が必要です`}
              variant={isApproved ? "secondary" : "default"}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              aria-label="破棄"
              disabled={isApproved}
              onClick={() => onReject(item.id)}
              size="icon"
              title="この候補を破棄"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">種別</label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isApproved}
              value={item.kind}
              onChange={(event) => onUpdate(item.id, { kind: event.target.value as ExtractionItem["kind"] })}
            >
              {extractionKindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">公開範囲</label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isApproved}
              value={item.visibility}
              onChange={(event) =>
                onUpdate(item.id, { visibility: event.target.value as ExtractionItem["visibility"] })
              }
            >
              {extractionVisibilityOptions.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {visibility}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">タイトル</label>
          <Input
            className="mt-1"
            disabled={isApproved}
            value={item.title}
            onBlur={(event) => onUpdate(item.id, { title: event.target.value.trim() })}
            onChange={(event) => onUpdate(item.id, { title: event.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">本文</label>
          <Textarea
            className="mt-1 min-h-[116px] resize-y text-sm leading-6 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApproved}
            value={item.detail}
            onBlur={(event) => onUpdate(item.id, { detail: event.target.value.trim() })}
            onChange={(event) => onUpdate(item.id, { detail: event.target.value })}
          />
        </div>

        {!canApprove && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            採用するには {missingFields.join("・")} を入力してください。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
