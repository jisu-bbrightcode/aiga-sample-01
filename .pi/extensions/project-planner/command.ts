// @ts-nocheck
import { parseLinearProjectId } from "./project-id";

const DEFAULT_TEAM_KEY = "FLT";
const ALLOWED_TEAMS = new Set(["FLT", "FLE", "FLP"]);

export interface ProjectCommandArgs {
  teamKey: string;
  existingProjectId: string | null;
}

export function parseProjectCommandArgs(raw: string): ProjectCommandArgs {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  let teamKey = DEFAULT_TEAM_KEY;
  let existingProjectId: string | null = null;

  for (const tok of tokens) {
    const upper = tok.toUpperCase();
    if (ALLOWED_TEAMS.has(upper)) {
      teamKey = upper;
      continue;
    }
    const projectId = parseLinearProjectId(tok);
    if (projectId) existingProjectId = projectId;
  }

  return { teamKey, existingProjectId };
}
