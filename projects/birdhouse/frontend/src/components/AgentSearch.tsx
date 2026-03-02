// ABOUTME: Search input component for filtering agents by title
// ABOUTME: Includes text input with debouncing and "include trees" checkbox

import { type Component, Show } from "solid-js";
import Checkbox from "./ui/Checkbox";

export interface AgentSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  includeTrees: boolean;
  onIncludeTreesChange: (include: boolean) => void;
  isSearching?: boolean;
  isLoading?: boolean;
  resultCount: number | undefined;
}

const AgentSearch: Component<AgentSearchProps> = (props) => {
  const handleClear = () => {
    props.onQueryChange("");
  };

  return (
    <div class="px-3 py-3 border-b border-border-muted bg-surface-raised space-y-2">
      {/* Search input */}
      <div class="relative">
        {/* Search icon */}
        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M14 14L11.1 11.1"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        {/* Input field */}
        <input
          type="text"
          value={props.query}
          onInput={(e) => props.onQueryChange(e.currentTarget.value)}
          placeholder="Search agents..."
          class="w-full pl-10 pr-10 py-2 rounded-lg text-sm border transition-colors bg-surface border-border text-text-primary placeholder:text-text-muted focus:border-accent outline-none"
          aria-label="Search agents by title"
          data-ph-capture-attribute-element-type="agent-search-input"
        />

        {/* Right side icons: loading spinner or clear button */}
        <div class="absolute right-3 top-1/2 -translate-y-1/2">
          <Show
            when={props.isSearching}
            fallback={
              <Show when={props.query.length > 0}>
                <button
                  type="button"
                  onClick={handleClear}
                  class="w-4 h-4 text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
                  aria-label="Clear search"
                  data-ph-capture-attribute-button-type="clear-agent-search"
                  data-ph-capture-attribute-query-length={props.query.length.toString()}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 4L4 12M4 4L12 12"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </Show>
            }
          >
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent" />
          </Show>
        </div>
      </div>

      {/* Include trees checkbox and result count - only show when search is active */}
      <Show when={props.query.length > 0 && !props.isSearching && !props.isLoading}>
        <div class="flex items-center justify-between">
          <Checkbox
            checked={props.includeTrees}
            onChange={props.onIncludeTreesChange}
            label="Include trees"
            data-ph-capture-attribute-element-type="include-trees-checkbox"
            data-ph-capture-attribute-is-checked={props.includeTrees ? "true" : "false"}
          />

          {/* Result count */}
          <Show when={props.resultCount !== undefined && props.query.length > 0}>
            <span class="text-xs text-text-muted">
              {props.resultCount} {props.resultCount === 1 ? "result" : "results"}
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default AgentSearch;
