import { useMemo, useState } from "react";
import { Download, FileText, RotateCcw } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import type { Chronicle, ClueStatus } from "../types";
import { countChronicleItems } from "../lib/campaign";

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

type ChronicleViewProps = {
  chronicle: Chronicle;
  onUpdateClueStatus?: (clueIndex: number, status: ClueStatus) => void;
  onUpdateNpcAttitude?: (npcIndex: number, attitude: string) => void;
  onUpdateThreadNextMove?: (threadIndex: number, nextMove: string) => void;
  onExportFilteredChronicle?: (chronicle: Chronicle) => void;
  onExportFilteredChronicleMarkdown?: (chronicle: Chronicle) => void;
};

export function ChronicleView({
  chronicle,
  onUpdateClueStatus,
  onUpdateNpcAttitude,
  onUpdateThreadNextMove,
  onExportFilteredChronicle,
  onExportFilteredChronicleMarkdown,
}: ChronicleViewProps) {
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
      npcs: chronicle.npcs.map((npc, index) => ({ npc, index })).filter(({ npc }) =>
        includesQuery([npc.name, npc.role, npc.publicKnowledge, npc.gmSecret, npc.attitude]),
      ),
      clues: chronicle.clues.map((clue, index) => ({ clue, index })).filter(({ clue }) => {
        if (clueStatusFilter !== "all" && clue.status !== clueStatusFilter) {
          return false;
        }

        return includesQuery([clue.title, clue.detail, statusLabels[clue.status]]);
      }),
      locations: chronicle.locations.filter((location) => includesQuery([location.name, location.detail])),
      threads: chronicle.threads.map((thread, index) => ({ thread, index })).filter(({ thread }) =>
        includesQuery([thread.title, thread.detail, thread.nextMove]),
      ),
    };
  }, [chronicle, clueStatusFilter, normalizedQuery]);
  const totalCount = countChronicleItems(chronicle);
  const filteredCount =
    filteredChronicle.events.length +
    filteredChronicle.clues.length +
    filteredChronicle.npcs.length +
    filteredChronicle.locations.length +
    filteredChronicle.threads.length;
  const exportableChronicle: Chronicle = {
    events: filteredChronicle.events,
    npcs: filteredChronicle.npcs.map(({ npc }) => npc),
    clues: filteredChronicle.clues.map(({ clue }) => clue),
    locations: filteredChronicle.locations,
    threads: filteredChronicle.threads.map(({ thread }) => thread),
  };
  const clueStatusCounts = chronicle.clues.reduce<Record<ClueStatus, number>>(
    (counts, clue) => ({
      ...counts,
      [clue.status]: counts[clue.status] + 1,
    }),
    {
      known: 0,
      partial: 0,
      hidden: 0,
    },
  );
  const nextRevealCandidates = [
    ...chronicle.clues
      .map((clue, index) => ({ clue, index }))
      .filter(({ clue }) => clue.status !== "known")
      .map(({ clue, index }) => ({
        clueIndex: index,
        id: `clue:${clue.title}:${clue.detail}`,
        kind: "clue" as const,
        title: clue.title,
        detail: clue.detail,
        label: statusLabels[clue.status],
      })),
    ...chronicle.threads.map((thread, index) => ({
      id: `thread:${index}:${thread.title}:${thread.detail}:${thread.nextMove}`,
      kind: "thread" as const,
      title: thread.title,
      detail: thread.nextMove,
      label: "伏線",
    })),
  ].slice(0, 6);

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
            <Badge variant="outline">PL既知 {clueStatusCounts.known}</Badge>
            <Badge variant="outline">一部既知 {clueStatusCounts.partial}</Badge>
            <Badge variant="outline">GM秘密 {clueStatusCounts.hidden}</Badge>
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
            {onExportFilteredChronicle && (
              <Button
                disabled={filteredCount === 0}
                onClick={() => onExportFilteredChronicle(exportableChronicle)}
                variant="outline"
              >
                <Download className="h-4 w-4" />
                表示中を書き出し
              </Button>
            )}
            {onExportFilteredChronicleMarkdown && (
              <Button
                disabled={filteredCount === 0}
                onClick={() => onExportFilteredChronicleMarkdown(exportableChronicle)}
                variant="outline"
              >
                <FileText className="h-4 w-4" />
                Markdown
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle count={nextRevealCandidates.length} label="次に出す候補" total={nextRevealCandidates.length} />
        </CardHeader>
        <CardContent className="grid gap-2">
          {nextRevealCandidates.length > 0 ? (
            nextRevealCandidates.map((candidate) => (
              <div className="rounded-md border p-3" key={candidate.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{candidate.title}</p>
                  <Badge variant="secondary">{candidate.label}</Badge>
                  <Button
                    onClick={() => {
                      setQuery(candidate.title);
                      setClueStatusFilter("all");
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    表示
                  </Button>
                  {candidate.kind === "clue" && onUpdateClueStatus && (
                    <Button
                      onClick={() => onUpdateClueStatus(candidate.clueIndex, "known")}
                      size="sm"
                      variant="outline"
                    >
                      PL既知にする
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{candidate.detail}</p>
              </div>
            ))
          ) : (
            <EmptyCategory label="次に出す候補" />
          )}
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
            filteredChronicle.clues.map(({ clue, index }) => (
              <div className="rounded-md border p-3" key={`${clue.title}-${clue.detail}-${index}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{clue.title}</p>
                    <Badge variant={clue.status === "hidden" ? "secondary" : "outline"}>
                      {statusLabels[clue.status]}
                    </Badge>
                  </div>
                  {onUpdateClueStatus && (
                    <select
                      aria-label={`${clue.title}の公開状態`}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={clue.status}
                      onChange={(event) => onUpdateClueStatus(index, event.target.value as ClueStatus)}
                    >
                      {clueStatusOptions.filter((option) => option.value !== "all").map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
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
              filteredChronicle.npcs.map(({ npc, index }) => (
                <div className="rounded-md border p-3" key={`${npc.name}-${npc.role}-${index}`}>
                  <p className="font-medium">{npc.name}</p>
                  <p className="text-sm text-muted-foreground">{npc.role}</p>
                  <p className="mt-2 text-sm leading-6">{npc.publicKnowledge}</p>
                  <div className="mt-3 grid gap-2 text-sm">
                    {onUpdateNpcAttitude ? (
                      <label className="grid gap-1 rounded-md bg-muted px-3 py-2">
                        <span className="font-medium">態度</span>
                        <Input
                          aria-label={`${npc.name}の態度`}
                          value={npc.attitude}
                          onBlur={(event) => onUpdateNpcAttitude(index, event.target.value.trim() || "態度未設定")}
                          onChange={(event) => onUpdateNpcAttitude(index, event.target.value)}
                        />
                      </label>
                    ) : (
                      <p className="rounded-md bg-muted px-3 py-2">
                        <span className="font-medium">態度:</span> {npc.attitude}
                      </p>
                    )}
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
                <div className="rounded-md border p-3" key={`${location.name}-${location.detail}`}>
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
              filteredChronicle.threads.map(({ thread, index }) => (
                <div className="rounded-md border p-3" key={`${thread.title}-${thread.detail}-${index}`}>
                  <p className="font-medium">{thread.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{thread.detail}</p>
                  {onUpdateThreadNextMove ? (
                    <Input
                      aria-label={`${thread.title}の次の一手`}
                      className="mt-2"
                      value={thread.nextMove}
                      onBlur={(event) => onUpdateThreadNextMove(index, event.target.value.trim() || "次の一手未設定")}
                      onChange={(event) => onUpdateThreadNextMove(index, event.target.value)}
                    />
                  ) : (
                    <p className="mt-2 text-sm leading-6">{thread.nextMove}</p>
                  )}
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
