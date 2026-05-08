import type { SessionState } from "../types";
import type { SessionStorageDiagnostic } from "./diagnostics";

export type SessionSortMode = "date-desc" | "size-desc" | "review-debt" | "title";

export function sortSessions(
  sessions: SessionState[],
  mode: SessionSortMode,
  storageDiagnosticsById: Map<string, SessionStorageDiagnostic>,
  reviewDebtById: Map<string, number>,
): SessionState[] {
  return [...sessions].sort((left, right) => {
    if (mode === "size-desc") {
      return (
        (storageDiagnosticsById.get(right.id)?.totalBytes ?? 0) -
        (storageDiagnosticsById.get(left.id)?.totalBytes ?? 0)
      );
    }

    if (mode === "review-debt") {
      return (reviewDebtById.get(right.id) ?? 0) - (reviewDebtById.get(left.id) ?? 0);
    }

    if (mode === "title") {
      return left.title.localeCompare(right.title, "ja");
    }

    return right.date.localeCompare(left.date);
  });
}
