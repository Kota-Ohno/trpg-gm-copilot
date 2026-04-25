import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Clock3,
  Compass,
  FileText,
  KeyRound,
  Lightbulb,
  Map,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Swords,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Tabs } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { initialChronicle, mockExtraction, prepNote, sampleLog } from "./data/sample";
import type { CampaignState, Chronicle, ExtractionItem, WorkspaceTab } from "./types";

const STORAGE_KEY = "chronicle-gm.campaign-state.v1";

const tabOptions: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "log", label: "ログ" },
  { value: "review", label: "承認" },
  { value: "chronicle", label: "記憶" },
  { value: "prep", label: "次回準備" },
];

const quickPrompts = [
  {
    icon: UserRound,
    title: "急なNPC",
    result: "潮見レン。灯台守の甥。怖がりだが、夜だけ灯台の鐘が鳴ることを知っている。",
  },
  {
    icon: KeyRound,
    title: "別ルートの手がかり",
    result: "倉庫の泥を水に溶かすと、灯台地下扉と同じ紋章の沈殿が残る。",
  },
  {
    icon: Lightbulb,
    title: "失敗判定の結果",
    result: "情報は得られるが、村長の協力者に探索を見られ、次の場面で先回りされる。",
  },
  {
    icon: Compass,
    title: "場面転換",
    result: "雨が止み、港の鐘が三度鳴る。岬の灯台だけが青白く明滅している。",
  },
];

const initialCampaignState: CampaignState = {
  campaignName: "灰ヶ浦異聞",
  log: sampleLog,
  extractionItems: [],
  approvedIds: [],
  chronicle: initialChronicle,
  quickResult: quickPrompts[0].result,
};

const statusLabels = {
  known: "PL既知",
  partial: "一部既知",
  hidden: "GM秘密",
};

function loadCampaignState(): CampaignState {
  if (typeof window === "undefined") {
    return initialCampaignState;
  }

  const savedState = window.localStorage.getItem(STORAGE_KEY);
  if (!savedState) {
    return initialCampaignState;
  }

  try {
    return {
      ...initialCampaignState,
      ...(JSON.parse(savedState) as Partial<CampaignState>),
    };
  } catch {
    return initialCampaignState;
  }
}

function applyExtraction(chronicle: Chronicle, item: ExtractionItem): Chronicle {
  if (item.kind === "NPC") {
    return {
      ...chronicle,
      npcs: [
        ...chronicle.npcs,
        {
          name: item.title,
          role: "セッションログから抽出",
          publicKnowledge: item.detail,
          gmSecret: item.visibility === "GMのみ" ? item.detail : "未設定",
          attitude: "未設定",
        },
      ],
    };
  }

  if (item.kind === "手がかり" || item.kind === "GM秘密") {
    return {
      ...chronicle,
      clues: [
        ...chronicle.clues,
        {
          title: item.title,
          detail: item.detail,
          status: item.visibility === "GMのみ" ? "hidden" : "known",
        },
      ],
    };
  }

  if (item.kind === "伏線") {
    return {
      ...chronicle,
      threads: [
        ...chronicle.threads,
        {
          title: item.title,
          detail: item.detail,
          nextMove: "次回準備で使う候補として保持する。",
        },
      ],
    };
  }

  return {
    ...chronicle,
    events: [...chronicle.events, `${item.title}: ${item.detail}`],
  };
}

export function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("log");
  const [campaignState, setCampaignState] = useState<CampaignState>(loadCampaignState);

  const { approvedIds, campaignName, chronicle, extractionItems: items, log, quickResult } = campaignState;

  const approvedCount = approvedIds.length;
  const remainingCount = items.length - approvedCount;

  const progress = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }
    return Math.round((approvedCount / items.length) * 100);
  }, [approvedCount, items.length]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaignState));
  }, [campaignState]);

  const updateCampaignState = (updates: Partial<CampaignState>): void => {
    setCampaignState((current) => ({ ...current, ...updates }));
  };

  const resetCampaignState = (): void => {
    window.localStorage.removeItem(STORAGE_KEY);
    setCampaignState(initialCampaignState);
    setActiveTab("log");
  };

  const runMockExtraction = (): void => {
    updateCampaignState({ extractionItems: mockExtraction, approvedIds: [] });
    setActiveTab("review");
  };

  const approveItem = (item: ExtractionItem): void => {
    if (approvedIds.includes(item.id)) {
      return;
    }
    setCampaignState((current) => ({
      ...current,
      approvedIds: [...current.approvedIds, item.id],
      chronicle: applyExtraction(current.chronicle, item),
    }));
  };

  const rejectItem = (itemId: string): void => {
    setCampaignState((current) => ({
      ...current,
      approvedIds: current.approvedIds.filter((id) => id !== itemId),
      extractionItems: current.extractionItems.filter((item) => item.id !== itemId),
    }));
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-[260px_1fr_320px] max-xl:grid-cols-[220px_1fr] max-lg:grid-cols-1">
        <aside className="border-r bg-sidebar px-4 py-5 max-lg:border-b max-lg:border-r-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Chronicle GM</p>
              <p className="text-xs text-muted-foreground">Investigation mode</p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">キャンペーン</label>
            <Input
              value={campaignName}
              onChange={(event) => updateCampaignState({ campaignName: event.target.value })}
            />
          </div>

          <nav className="mt-6 space-y-1">
            {[
              { icon: Search, label: "調査ボード", count: chronicle.clues.length },
              { icon: UserRound, label: "NPC", count: chronicle.npcs.length },
              { icon: Map, label: "場所", count: chronicle.locations.length },
              { icon: Clock3, label: "年表", count: chronicle.events.length },
              { icon: Sparkles, label: "伏線", count: chronicle.threads.length },
            ].map((item) => (
              <button
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                key={item.label}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
                <Badge variant="muted">{item.count}</Badge>
              </button>
            ))}
          </nav>

          <div className="mt-6 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">承認進捗</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {approvedCount}件承認済み、{remainingCount}件が未処理です。
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-6 py-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">{campaignName}</h1>
              <p className="text-sm text-muted-foreground">
                セッションログから手がかり、秘密、伏線を抽出して次回準備へつなげます。
              </p>
            </div>
            <Tabs value={activeTab} options={tabOptions} onChange={setActiveTab} />
          </header>

          <div className="mt-5">
            {activeTab === "log" && (
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      セッションログ
                    </CardTitle>
                    <CardDescription>
                      初期MVPでは貼り付け入力に絞ります。ココフォリアやDiscordログの取り込みは後から足せます。
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      className="min-h-[420px] resize-y font-mono text-sm leading-6"
                      value={log}
                      onChange={(event) => updateCampaignState({ log: event.target.value })}
                    />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-muted-foreground">{log.length.toLocaleString()}文字</p>
                        <Badge variant="outline">ローカル自動保存</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={resetCampaignState} variant="outline">
                          <RotateCcw className="h-4 w-4" />
                          デモ初期化
                        </Button>
                        <Button onClick={runMockExtraction}>
                          <Wand2 className="h-4 w-4" />
                          抽出プレビュー
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "review" && (
              <div className="grid gap-4">
                {items.length === 0 ? (
                  <EmptyState onStart={() => setActiveTab("log")} />
                ) : (
                  items.map((item) => {
                    const isApproved = approvedIds.includes(item.id);

                    return (
                      <Card className={isApproved ? "border-primary/40 bg-primary/5" : ""} key={item.id}>
                        <CardHeader className="flex-row items-start justify-between gap-4">
                          <div>
                            <div className="mb-2 flex flex-wrap gap-2">
                              <Badge>{item.kind}</Badge>
                              <Badge variant={item.visibility === "GMのみ" ? "secondary" : "outline"}>
                                {item.visibility}
                              </Badge>
                            </div>
                            <CardTitle>{item.title}</CardTitle>
                            <CardDescription className="mt-2 leading-6">{item.detail}</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              aria-label="採用"
                              disabled={isApproved}
                              onClick={() => approveItem(item)}
                              size="icon"
                              variant={isApproved ? "secondary" : "default"}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button aria-label="破棄" onClick={() => rejectItem(item.id)} size="icon" variant="outline">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "chronicle" && <ChronicleView chronicle={chronicle} />}

            {activeTab === "prep" && (
              <div className="grid gap-4">
                <PrepSection title="3行あらすじ" items={prepNote.shortRecap} icon={FileText} />
                <PrepSection title="次回導入案" items={prepNote.hooks} icon={Compass} />
                <PrepSection title="未解決の問い" items={prepNote.openQuestions} icon={Search} />
                <PrepSection title="GM確認メモ" items={prepNote.reminders} icon={KeyRound} />
              </div>
            )}
          </div>
        </section>

        <aside className="border-l bg-panel px-4 py-5 max-xl:col-span-2 max-xl:border-l-0 max-xl:border-t max-lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">即興レスキュー</p>
              <p className="text-xs text-muted-foreground">セッション中に使う短い候補</p>
            </div>
            <Button size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 grid gap-2">
            {quickPrompts.map((prompt) => (
              <Button
                className="justify-start"
                key={prompt.title}
                onClick={() => updateCampaignState({ quickResult: prompt.result })}
                variant="outline"
              >
                <prompt.icon className="h-4 w-4" />
                {prompt.title}
              </Button>
            ))}
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                候補
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6">{quickResult}</p>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="h-4 w-4" />
                拡張予定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>ファンタジーモードでは、手がかりをクエスト、秘密を勢力事情、伏線を世界変化へ置き換えます。</p>
              <p>AI接続はユーザーAPIキー方式にして、ローカル保存を基本にします。</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>抽出結果はまだありません</CardTitle>
        <CardDescription>ログを貼り付けて抽出プレビューを実行してください。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onStart}>ログへ戻る</Button>
      </CardContent>
    </Card>
  );
}

function ChronicleView({ chronicle }: { chronicle: Chronicle }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>手がかり</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {chronicle.clues.map((clue) => (
            <div className="rounded-md border p-3" key={`${clue.title}-${clue.detail}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{clue.title}</p>
                <Badge variant={clue.status === "hidden" ? "secondary" : "outline"}>{statusLabels[clue.status]}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{clue.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>NPC</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chronicle.npcs.map((npc) => (
              <div className="rounded-md border p-3" key={npc.name}>
                <p className="font-medium">{npc.name}</p>
                <p className="text-sm text-muted-foreground">{npc.role}</p>
                <p className="mt-2 text-sm leading-6">{npc.publicKnowledge}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>伏線</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chronicle.threads.map((thread) => (
              <div className="rounded-md border p-3" key={thread.title}>
                <p className="font-medium">{thread.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{thread.detail}</p>
                <p className="mt-2 text-sm leading-6">{thread.nextMove}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PrepSection({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: typeof FileText;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li className="rounded-md border bg-background px-3 py-2 text-sm leading-6" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
