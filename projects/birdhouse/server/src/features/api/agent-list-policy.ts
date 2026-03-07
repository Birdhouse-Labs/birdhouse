// ABOUTME: Parses and validates list and search query parameters for agent routes
// ABOUTME: Keeps route policy pure so handlers can preserve existing response behavior

import type { SortDirection, SortOrder } from "../../lib/agents-db";

export type SearchSortField = "relevance" | SortOrder;

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

export type SearchAgentsPolicy =
  | PolicySuccess<{
      query: string;
      hasQuery: boolean;
      includeTrees: boolean;
      sortBy: SearchSortField;
      order: SortDirection;
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

export function parseSearchAgentsPolicy(params: {
  q?: string;
  includeTrees?: string;
  sortBy?: string;
  order?: string;
}): SearchAgentsPolicy {
  const query = params.q || "";

  let includeTrees = false;
  if (params.includeTrees !== undefined) {
    if (params.includeTrees !== "true" && params.includeTrees !== "false") {
      return {
        ok: false,
        status: 400,
        error: "includeTrees must be 'true' or 'false'",
      };
    }
    includeTrees = params.includeTrees === "true";
  }

  const hasQuery = query.trim().length > 0;
  const defaultSortBy: SearchSortField = hasQuery ? "relevance" : "updated_at";
  const sortBy = (params.sortBy || defaultSortBy) as SearchSortField;

  if (sortBy !== "relevance" && sortBy !== "updated_at" && sortBy !== "created_at") {
    return {
      ok: false,
      status: 400,
      error: "sortBy must be 'relevance', 'updated_at', or 'created_at'",
    };
  }

  const order = (params.order || "desc") as SortDirection;
  if (order !== "asc" && order !== "desc") {
    return {
      ok: false,
      status: 400,
      error: "order must be 'asc' or 'desc'",
    };
  }

  if (sortBy === "relevance" && !hasQuery) {
    return {
      ok: false,
      status: 400,
      error: "sortBy=relevance requires a non-empty query",
    };
  }

  return {
    ok: true,
    query,
    hasQuery,
    includeTrees,
    sortBy,
    order,
  };
}
