import { describe, expect, it } from "vitest";
import type { SessionState } from "../types";
import type { SessionStorageDiagnostic } from "./diagnostics";
import { sortSessions } from "./session-list";

const session = (id: string, title: string, date: string): SessionState => ({
  id,
  title,
  date,
  log: "",
  liveLog: {
    id: `${id}-live-log`,
    title,
    sourceType: "manual",
    speakers: [],
    segments: [],
  },
  extractionItems: [],
  extractionRun: null,
  transcriptionRun: null,
  approvedIds: [],
});

const sessions = [
  session("b", "第2夜", "2026-05-02"),
  session("a", "第1夜", "2026-05-01"),
  session("c", "幕間", "2026-05-03"),
];

const storage = (sessionId: string, totalBytes: number): SessionStorageDiagnostic => ({
  campaignId: "campaign",
  campaignName: "Campaign",
  sessionId,
  sessionTitle: sessionId,
  totalBytes,
  logBytes: 0,
  speakerLogBytes: 0,
  reviewBytes: 0,
  transcriptionBytes: 0,
});

describe("sortSessions", () => {
  it("sorts by newest date first by default", () => {
    expect(sortSessions(sessions, "date-desc", new Map(), new Map()).map((item) => item.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts by storage size descending", () => {
    expect(sortSessions(
      sessions,
      "size-desc",
      new Map([
        ["a", storage("a", 300)],
        ["b", storage("b", 100)],
        ["c", storage("c", 200)],
      ]),
      new Map(),
    ).map((item) => item.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by review debt descending", () => {
    expect(sortSessions(
      sessions,
      "review-debt",
      new Map(),
      new Map([
        ["a", 1],
        ["b", 4],
        ["c", 2],
      ]),
    ).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by title using Japanese collation", () => {
    expect(sortSessions(sessions, "title", new Map(), new Map()).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
