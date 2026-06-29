import type { EmailLogsFilters } from "./types";

export const adminEmailQueryKeys = {
  logsPrefix: () => ["admin", "email", "logs"] as const,
  logs: (filters: Required<Pick<EmailLogsFilters, "page" | "limit">> & EmailLogsFilters) =>
    [...adminEmailQueryKeys.logsPrefix(), filters] as const,
  logPrefix: () => ["admin", "email", "log"] as const,
  log: (logId: string) => [...adminEmailQueryKeys.logPrefix(), logId] as const,
};
