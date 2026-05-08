import type { Chronicle, ExtractionItem, LiveLogSession, PrepNote } from "../types";

export const sampleLog = `KP: 前回の続きです。探索者たちは雨の降る港町・灰ヶ浦に到着しました。
真壁: まず港の倉庫街を調べたいです。
KP: 倉庫の鍵は壊されていて、床には銀色の泥が乾いて残っています。
佐伯: 銀色の泥？ 昨日、村長の靴にも似た汚れがありましたよね。
KP: そうですね。ただ村長は「古い灯台には近づくな」とだけ言って口を閉ざします。
真壁: 灯台に行く前に、酒場で噂を集めます。
KP: 酒場の女将ミヨは、三日前の夜に岬で青白い光を見たと言います。
佐伯: ミヨに村長のことを聞きます。
KP: ミヨは、村長は怪物ではない、むしろ何かを封じているように見えた、と小声で話します。
真壁: じゃあ灯台へ。隠れて近づきます。
KP: 灯台の地下扉には、潮で錆びた紋章と「月が沈むまで開けるな」という古い文字があります。`;

export const sampleLiveLog: LiveLogSession = {
  id: "session-haigaura-01",
  title: "灰ヶ浦異聞 第1夜",
  sourceType: "sample",
  speakers: [
    {
      id: "speaker-gm",
      name: "KP",
      role: "GM",
    },
    {
      id: "speaker-makabe",
      name: "真壁",
      role: "PL",
    },
    {
      id: "speaker-saeki",
      name: "佐伯",
      role: "PL",
    },
  ],
  segments: [
    {
      id: "segment-1",
      speakerId: "speaker-gm",
      startTimeSec: 0,
      endTimeSec: 7,
      text: "前回の続きです。探索者たちは雨の降る港町・灰ヶ浦に到着しました。",
      confidence: 0.98,
    },
    {
      id: "segment-2",
      speakerId: "speaker-makabe",
      startTimeSec: 8,
      endTimeSec: 12,
      text: "まず港の倉庫街を調べたいです。",
      confidence: 0.96,
    },
    {
      id: "segment-3",
      speakerId: "speaker-gm",
      startTimeSec: 13,
      endTimeSec: 22,
      text: "倉庫の鍵は壊されていて、床には銀色の泥が乾いて残っています。",
      confidence: 0.97,
    },
    {
      id: "segment-4",
      speakerId: "speaker-saeki",
      startTimeSec: 24,
      endTimeSec: 30,
      text: "銀色の泥？ 昨日、村長の靴にも似た汚れがありましたよね。",
      confidence: 0.94,
    },
    {
      id: "segment-5",
      speakerId: "speaker-gm",
      startTimeSec: 31,
      endTimeSec: 40,
      text: "そうですね。ただ村長は「古い灯台には近づくな」とだけ言って口を閉ざします。",
      confidence: 0.98,
    },
    {
      id: "segment-6",
      speakerId: "speaker-makabe",
      startTimeSec: 42,
      endTimeSec: 47,
      text: "灯台に行く前に、酒場で噂を集めます。",
      confidence: 0.96,
    },
    {
      id: "segment-7",
      speakerId: "speaker-gm",
      startTimeSec: 48,
      endTimeSec: 57,
      text: "酒場の女将ミヨは、三日前の夜に岬で青白い光を見たと言います。",
      confidence: 0.97,
    },
    {
      id: "segment-8",
      speakerId: "speaker-saeki",
      startTimeSec: 59,
      endTimeSec: 62,
      text: "ミヨに村長のことを聞きます。",
      confidence: 0.95,
    },
    {
      id: "segment-9",
      speakerId: "speaker-gm",
      startTimeSec: 63,
      endTimeSec: 74,
      text: "ミヨは、村長は怪物ではない、むしろ何かを封じているように見えた、と小声で話します。",
      confidence: 0.97,
    },
    {
      id: "segment-10",
      speakerId: "speaker-makabe",
      startTimeSec: 76,
      endTimeSec: 80,
      text: "じゃあ灯台へ。隠れて近づきます。",
      confidence: 0.96,
    },
    {
      id: "segment-11",
      speakerId: "speaker-gm",
      startTimeSec: 81,
      endTimeSec: 94,
      text: "灯台の地下扉には、潮で錆びた紋章と「月が沈むまで開けるな」という古い文字があります。",
      confidence: 0.98,
    },
  ],
};

export const initialChronicle: Chronicle = {
  events: [
    "探索者たちは港町・灰ヶ浦に到着した。",
    "村長が古い灯台へ近づかないよう警告した。",
  ],
  npcs: [
    {
      name: "村長",
      role: "灰ヶ浦のまとめ役",
      publicKnowledge: "古い灯台へ近づくなと警告している。",
      gmSecret: "怪物ではなく、何かを封じている可能性がある。",
      attitude: "探索者を遠ざけたいが、敵意は薄い。",
    },
  ],
  clues: [
    {
      title: "銀色の泥",
      status: "known",
      detail: "村長の靴と倉庫の床で似た泥が見つかっている。",
    },
    {
      title: "古い灯台",
      status: "partial",
      detail: "村長が接近を止めている。岬で青白い光が目撃された。",
    },
  ],
  locations: [
    {
      name: "灰ヶ浦",
      detail: "雨の多い港町。倉庫街と古い灯台がある。",
    },
  ],
  threads: [
    {
      title: "灯台の地下扉",
      detail: "月が沈むまで開けるな、という警告文がある。",
      nextMove: "月の満ち欠け、紋章、村長の過去に接続できる。",
    },
  ],
};

export const mockExtraction: ExtractionItem[] = [
  {
    id: "event-1",
    kind: "出来事",
    title: "倉庫街で銀色の泥を発見",
    detail: "壊された倉庫の床に、村長の靴と似た銀色の泥が残っていた。",
    visibility: "PL既知",
  },
  {
    id: "npc-1",
    kind: "NPC",
    title: "ミヨ",
    detail: "酒場の女将。三日前の夜に岬で青白い光を見た。村長は何かを封じているようだと話す。",
    visibility: "PL既知",
  },
  {
    id: "clue-1",
    kind: "手がかり",
    title: "青白い光",
    detail: "三日前の夜、岬で目撃された。灯台の地下扉か封印と関係している可能性がある。",
    visibility: "PL既知",
  },
  {
    id: "secret-1",
    kind: "GM秘密",
    title: "村長は敵ではない",
    detail: "村長は怪物の協力者ではなく、封印を維持する側かもしれない。",
    visibility: "GMのみ",
  },
  {
    id: "thread-1",
    kind: "伏線",
    title: "月が沈むまで開けるな",
    detail: "灯台地下扉の警告。開けるタイミングで封印の強度や怪異の出方が変わる。",
    visibility: "PL既知",
  },
];

export const prepNote: PrepNote = {
  shortRecap: [
    "探索者たちは灰ヶ浦の倉庫街で、村長の靴と似た銀色の泥を発見した。",
    "酒場の女将ミヨは、岬の青白い光と村長の不審な行動を証言した。",
    "古い灯台の地下扉には、月が沈むまで開けるなという警告が刻まれていた。",
  ],
  hooks: [
    "村長が夜明け前に灯台へ向かう場面から始める。",
    "ミヨが探索者へ、村長の娘が行方不明だと打ち明ける。",
    "倉庫の銀色の泥が、潮ではなく古い儀式の灰だと判明する。",
  ],
  openQuestions: [
    "村長は誰を、または何を封じているのか。",
    "三日前の青白い光は封印の劣化か、誰かの介入か。",
    "地下扉を月が沈む前に開けると何が起きるのか。",
  ],
  reminders: [
    "PLには村長が敵とは確定させない。",
    "銀色の泥を手がかりとして、灯台以外の調査ルートも残す。",
    "ミヨは味方寄りだが、すべてを知っているわけではない。",
  ],
};
