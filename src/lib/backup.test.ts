import { describe, expect, it } from "vitest";
import { getBackupStatus } from "./backup";

describe("getBackupStatus", () => {
  it("requests backup when no valid backup timestamp exists", () => {
    expect(getBackupStatus(null)).toEqual({
      ageDays: null,
      label: "バックアップ未作成",
      needsBackup: true,
    });
    expect(getBackupStatus("bad-date")).toEqual({
      ageDays: null,
      label: "バックアップ日時不明",
      needsBackup: true,
    });
  });

  it("marks backups older than a week as stale", () => {
    const now = new Date("2026-05-10T00:00:00.000Z");

    expect(getBackupStatus("2026-05-10T00:00:00.000Z", now)).toEqual({
      ageDays: 0,
      label: "本日バックアップ済み",
      needsBackup: false,
    });
    expect(getBackupStatus("2026-05-01T00:00:00.000Z", now)).toEqual({
      ageDays: 9,
      label: "9日前にバックアップ",
      needsBackup: true,
    });
  });
});
