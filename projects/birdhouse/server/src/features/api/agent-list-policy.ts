// ABOUTME: Parses and validates list query parameters for agent routes
// ABOUTME: Keeps route policy pure so handlers can preserve existing response behavior

import type { SortOrder } from "../../lib/agents-db";

type PolicyError = {
  ok: false;
  status: 400;
  error: string;
};

type PolicySuccess<T> = T & {
  ok: true;
};

export type GetAgentsPolicy =
  | PolicySuccess<{
      sortBy: SortOrder;
    }>
  | PolicyError;

export function parseGetAgentsPolicy(params: { sortBy?: string }): GetAgentsPolicy {
  const { sortBy } = params;

  if (sortBy && sortBy !== "updated_at" && sortBy !== "created_at") {
    return {
      ok: false,
      status: 400,
      error: "Invalid sortBy parameter",
    };
  }

  return {
    ok: true,
    sortBy: (sortBy || "updated_at") as SortOrder,
  };
}
