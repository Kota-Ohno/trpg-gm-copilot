import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import type { Chronicle, ClueStatus } from "../types";

const statusLabels = {
  known: "PL既知",
  partial: "一部既知",
  hidden: "GM秘密",
};

type ClueStatusFilter = "all" | ClueStatus;
const clueStatusOptions: Array<{ value: ClueStatusFilter; label: string }> = [
  { value: "all", label: "全手がかり" },
  { value: "known", label: "PL既知" },
  { value: "partial", label: "一部既知" },
  { value: "hidden", label: "GM秘密" },
];

function EmptyCategory({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
      {label}はありません。
    </div>
  );
}

function SectionTitle({ count, label, total }: { count: number; label: string; total: number }) {
  const countLabel = count === total ? `${total}` : `${count}/${total}`;

  return (
    <CardTitle className="flex items-center gap-2">
      <span>{label}</span>
      <Badge variant="outline">{countLabel}件</Badge>
    </CardTitle>
  );
}

function countChronicleItems(chronicle: Chronicle): number {
  return (
    chronicle.events.length +
    chronicle.clues.length +
    chronicle.npcs.length +
    chronicle.locations.length +
    chronicle.threads.length
  );
}

export function ChronicleView({ chronicle }: { chronicle: Chronicle }) {
  const [query, setQuery] = useState("");
  const [clueStatusFilter, setClueStatusFilter] = useState<ClueStatusFilter>("all");
  const normalizedQuery = query.trim().toLowerCase();
  const hasFilter = normalizedQuery.length > 0 || clueStatusFilter !== "all";
  const filteredChronicle = useMemo(() => {
    const includesQuery = (values: string[]) =>
      !normalizedQuery ||
      values.some((value) => value.toLowerCase().includes(normalizedQuery));

    return {
      events: chronicle.events.filter((event) => includesQuery([event])),
      npcs: chronicle.npcs.filter((npc) =>
        includesQuery([npc.name, npc.role, npc.publicKnowledge, npc.gmSecret, npc.attitude]),
      ),
      clues: chronicle.clues.filter((clue) => {
        if (clueStatusFilter !== "all" && clue.status !== clueStatusFilter) {
          return false;
        }

        return includesQuery([clue.title, clue.detail, statusLabels[clue.status]]);
      }),
      locations: chronicle.locations.filter((location) => includesQuery([location.name, location.detail])),
      threads: chronicle.threads.filter((thread) => includesQuery([thread.title, thread.detail, thread.nextMove])),
    };
  }, [chronicle, clueStatusFilter, normalizedQuery]);
  const totalCount = countChronicleItems(chronicle);
  const filteredCount = countChronicleItems(filteredChronicle);

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 py-3">
          <Input
            aria-label="キャンペーン記憶を検索"
            placeholder="記憶を検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{hasFilter ? `${filteredCount}/${totalCount}件表示` : `${totalCount}件`}</Badge>
            {normalizedQuery && <Badge variant="secondary">検索: {query.trim()}</Badge>}
            {clueStatusFilter !== "all" && (
              <Badge variant="secondary">手がかり: {statusLabels[clueStatusFilter]}</Badge>
            )}
            <Badge variant="outline">出来事 {chronicle.events.length}</Badge>
            <Badge variant="outline">手がかり {chronicle.clues.length}</Badge>
            <Badge variant="outline">NPC {chronicle.npcs.length}</Badge>
            <Badge variant="outline">場所 {chronicle.locations.length}</Badge>
            <Badge variant="outline">伏線 {chronicle.threads.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={clueStatusFilter}
              onChange={(event) => setClueStatusFilter(event.target.value as ClueStatusFilter)}
            >
              {clueStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              disabled={!hasFilter}
              onClick={() => {
                setQuery("");
                setClueStatusFilter("all");
              }}
              variant="outline"
            >
              <RotateCcw className="h-4 w-4" />
              解除
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle count={filteredChronicle.events.length} label="出来事" total={chronicle.events.length} />
        </CardHeader>
        <CardContent className="grid gap-2">
          {filteredChronicle.events.length > 0 ? (
            filteredChronicle.events.map((event, index) => (
              <div className="rounded-md border p-3" key={`${event}-${index}`}>
                <p className="text-sm leading-6">{event}</p>
              </div>
            ))
          ) : (
            <EmptyCategory label="出来事" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle count={filteredChronicle.clues.length} label="手がかり" total={chronicle.clues.length} />
        </CardHeader>
        <CardContent className="grid gap-3">
          {filteredChronicle.clues.length > 0 ? (
            filteredChronicle.clues.map((clue) => (
              <div className="rounded-md border p-3" key={`${clue.title}-${clue.detail}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{clue.title}</p>
                  <Badge variant={clue.status === "hidden" ? "secondary" : "outline"}>{statusLabels[clue.status]}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{clue.detail}</p>
              </div>
            ))
          ) : (
            <EmptyCategory label="手がかり" />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <CardHeader>
            <SectionTitle count={filteredChronicle.npcs.length} label="NPC" total={chronicle.npcs.length} />
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredChronicle.npcs.length > 0 ? (
              filteredChronicle.npcs.map((npc) => (
                <div className="rounded-md border p-3" key={npc.name}>
                  <p className="font-medium">{npc.name}</p>
                  <p className="text-sm text-muted-foreground">{npc.role}</p>
                  <p className="mt-2 text-sm leading-6">{npc.publicKnowledge}</p>
                  <div className="mt-3 grid gap-2 text-sm">
                    <p className="rounded-md bg-muted px-3 py-2">
                      <span className="font-medium">態度:</span> {npc.attitude}
                    </p>
                    <p className="rounded-md bg-secondary/40 px-3 py-2">
                      <span className="font-medium">GM秘密:</span> {npc.gmSecret}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyCategory label="NPC" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle count={filteredChronicle.locations.length} label="場所" total={chronicle.locations.length} />
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredChronicle.locations.length > 0 ? (
              filteredChronicle.locations.map((location) => (
                <div className="rounded-md border p-3" key={location.name}>
                  <p className="font-medium">{location.name}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{location.detail}</p>
                </div>
              ))
            ) : (
              <EmptyCategory label="場所" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle count={filteredChronicle.threads.length} label="伏線" total={chronicle.threads.length} />
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredChronicle.threads.length > 0 ? (
              filteredChronicle.threads.map((thread) => (
                <div className="rounded-md border p-3" key={thread.title}>
                  <p className="font-medium">{thread.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{thread.detail}</p>
                  <p className="mt-2 text-sm leading-6">{thread.nextMove}</p>
                </div>
              ))
            ) : (
              <EmptyCategory label="伏線" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
