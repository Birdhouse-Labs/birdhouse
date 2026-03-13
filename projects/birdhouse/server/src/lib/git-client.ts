// ABOUTME: Git client abstraction for fetching branch and PR info.
// ABOUTME: Provides live (Bun.spawn + gh CLI) and test implementations.

export class GitClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitClientError";
  }
}

export class GitRepoNotFoundError extends GitClientError {
  constructor(message: string) {
    super(message);
    this.name = "GitRepoNotFoundError";
  }
}

export class GhNotInstalledError extends GitClientError {
  constructor(message: string) {
    super(message);
    this.name = "GhNotInstalledError";
  }
}

export class GhAuthError extends GitClientError {
  constructor(message: string) {
    super(message);
    this.name = "GhAuthError";
  }
}

export type PullRequestState = "open" | "closed" | "merged";
export type ReviewDecision = "approved" | "changes_requested" | "review_required" | "none";
export type ChecksStatus = "pending" | "success" | "failure" | "none";

export interface PullRequestInfo {
  number: number;
  title: string;
  url: string;
  state: PullRequestState;
  isDraft: boolean;
  reviewDecision: ReviewDecision;
  checksStatus: ChecksStatus;
}

export interface GitClient {
  getCurrentBranch(dir: string): Promise<string>;
  getPullRequests(dir: string, branch: string): Promise<PullRequestInfo[]>;
}

export interface GhPrResult {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  reviewDecision: string;
  statusCheckRollup: { state: string }[];
}

export async function runCommand(cmd: string[], cwd: string): Promise<string> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new GhNotInstalledError(`Command not found: ${cmd[0]}\n${msg}`);
    }
    throw err;
  }
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim();
    const message = `Command failed (exit ${exitCode}): ${cmd.join(" ")}\n${stderr}`;
    if (/not a git repository/i.test(stderr)) {
      throw new GitRepoNotFoundError(message);
    }
    if (exitCode === 127 || /command not found/i.test(stderr)) {
      throw new GhNotInstalledError(message);
    }
    if (/auth|login/i.test(stderr)) {
      throw new GhAuthError(message);
    }
    throw new Error(message);
  }
  return stdout.trim();
}

export function normalizeState(state: string): PullRequestState {
  const lower = state.toLowerCase();
  if (lower === "merged") return "merged";
  if (lower === "closed") return "closed";
  return "open";
}

export function normalizeReviewDecision(decision: string): ReviewDecision {
  const upper = decision.toUpperCase();
  if (upper === "APPROVED") return "approved";
  if (upper === "CHANGES_REQUESTED") return "changes_requested";
  if (upper === "REVIEW_REQUIRED") return "review_required";
  return "none";
}

export function normalizeChecksStatus(rollup: { state: string }[]): ChecksStatus {
  if (!rollup || rollup.length === 0) return "none";
  const states = rollup.map((c) => c.state.toUpperCase());
  if (states.some((s) => s === "FAILURE" || s === "ERROR")) return "failure";
  if (states.some((s) => s === "PENDING" || s === "EXPECTED")) return "pending";
  return "success";
}

export function mapPrResult(pr: GhPrResult): PullRequestInfo {
  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: normalizeState(pr.state),
    isDraft: pr.isDraft,
    reviewDecision: normalizeReviewDecision(pr.reviewDecision ?? ""),
    checksStatus: normalizeChecksStatus(pr.statusCheckRollup ?? []),
  };
}

export function createLiveGitClient(): GitClient {
  return {
    async getCurrentBranch(dir: string): Promise<string> {
      return runCommand(["git", "rev-parse", "--abbrev-ref", "HEAD"], dir);
    },

    async getPullRequests(dir: string, branch: string): Promise<PullRequestInfo[]> {
      const json = await runCommand(
        [
          "gh",
          "pr",
          "list",
          "--head",
          branch,
          "--json",
          "number,title,url,state,isDraft,reviewDecision,statusCheckRollup",
          "--limit",
          "5",
        ],
        dir,
      );
      if (!json) return [];
      const results: GhPrResult[] = JSON.parse(json);
      return results.map(mapPrResult);
    },
  };
}

export function createTestGitClient(overrides?: Partial<GitClient>): GitClient {
  return {
    async getCurrentBranch(): Promise<string> {
      return "main";
    },
    async getPullRequests(): Promise<PullRequestInfo[]> {
      return [];
    },
    ...overrides,
  };
}
