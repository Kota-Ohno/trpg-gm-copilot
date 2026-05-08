export type BackupStatus = {
  ageDays: number | null;
  label: string;
  needsBackup: boolean;
};

export function getBackupStatus(lastBackupAt: string | null, now = new Date()): BackupStatus {
  if (!lastBackupAt) {
    return {
      ageDays: null,
      label: "バックアップ未作成",
      needsBackup: true,
    };
  }

  const backupDate = new Date(lastBackupAt);
  if (Number.isNaN(backupDate.getTime())) {
    return {
      ageDays: null,
      label: "バックアップ日時不明",
      needsBackup: true,
    };
  }

  const ageDays = Math.max(0, Math.floor((now.getTime() - backupDate.getTime()) / 86_400_000));

  return {
    ageDays,
    label: ageDays === 0 ? "本日バックアップ済み" : `${ageDays}日前にバックアップ`,
    needsBackup: ageDays >= 7,
  };
}
