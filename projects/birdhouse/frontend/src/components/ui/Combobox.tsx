// ABOUTME: Combobox component with typeahead filtering and keyboard navigation
// ABOUTME: Framework-agnostic autocomplete using solid-floating-ui for positioning

import { autoUpdate, flip, offset, size } from "@floating-ui/dom";
import { useFloating } from "solid-floating-ui";
import { createEffect, createSignal, createUniqueId, For, type JSX, onCleanup, Show } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { uiSize } from "../../theme";

export interface ComboboxOption<T = unknown> {
  value: T;
  label: string;
  description?: string | undefined;
  disabled?: boolean;
}

export type ComboboxRenderFn<T = unknown> = (option: ComboboxOption<T>, isHighlighted: boolean) => JSX.Element;

export interface ComboboxProps<T = unknown> {
  options: ComboboxOption<T>[];
  value?: T;
  onSelect: (value: T) => void;
  onPreview?: (value: T) => void;
  placeholder?: string;
  filterFn?: (option: ComboboxOption<T>, query: string) => boolean;
  renderOption?: ComboboxRenderFn<T>;
  // Overrides the label shown in the input when the dropdown is closed
  displayValue?: string | undefined;
  class?: string;
  inputClass?: string;
  dropdownClass?: string;
  noResultsMessage?: string;
  maxHeight?: string;
  icon?: JSX.Element; // Custom icon to show instead of default arrow
  iconOpen?: JSX.Element; // Custom icon when dropdown is open (defaults to same as icon)
  showIcon?: boolean; // Whether to show the dropdown arrow (default true)
}

const defaultFilterFn = <T,>(option: ComboboxOption<T>, query: string): boolean => {
  const searchText = `${option.label} ${option.description || ""}`.toLowerCase();
  return searchText.includes(query.toLowerCase());
};

// Built-in render helpers
export const renderHorizontal: ComboboxRenderFn = (option) => (
  <div class="flex items-baseline gap-2">
    <span class="font-medium text-text-primary">{option.label}</span>
    <Show when={option.description}>
      <span class="text-text-secondary text-xs">{option.description}</span>
    </Show>
  </div>
);

export const renderVertical: ComboboxRenderFn = (option) => (
  <div>
    <div class="font-medium text-text-primary">{option.label}</div>
    <Show when={option.description}>
      <div class="text-text-secondary text-xs mt-0.5">{option.description}</div>
    </Show>
  </div>
);

export const Combobox = <T,>(props: ComboboxProps<T>) => {
  const baseZIndex = useZIndex();
  // Two modes with optional quick-nav toggle:
  // Mode 1: isFocused = false → blurred
  // Mode 2a (default): isFocused = true, showDropdown = true → standard dropdown with preview
  // Mode 2b (Cmd+Enter): isFocused = true, showDropdown = false → quick-nav with position indicator
  const [isFocused, setIsFocused] = createSignal(false);
  const [showDropdown, setShowDropdown] = createSignal(false);
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  const [committedValue, setCommittedValue] = createSignal<T | undefined>(props.value);
  const [hasInteracted, setHasInteracted] = createSignal(false);

  // Initialize inputValue with current selection (prevents flash on first open)
  const initialDisplayValue = () => {
    if (!props.value) return props.displayValue || "";
    const option = props.options.find((opt) => opt.value === props.value);
    return props.displayValue || option?.label || "";
  };
  const [inputValue, setInputValue] = createSignal(initialDisplayValue());

  const uniqueId = createUniqueId();
  const listboxId = `combobox-listbox-${uniqueId}`;

  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLElement | undefined;

  // Track the committed value when FIRST opening dropdown (not on every props.value change)
  createEffect(() => {
    if (showDropdown() && !hasInteracted()) {
      setCommittedValue(() => props.value);
    }
  });

  // Find display value for a given value (or committed if not specified)
  // Returns just the option label (used for typeahead matching while focused)
  const getDisplayValueFor = (value?: T) => {
    const targetValue = value ?? committedValue();
    if (!targetValue) return "";
    const option = props.options.find((opt) => opt.value === targetValue);
    return option?.label || "";
  };

  // Returns the label shown in the input when blurred (may be overridden by displayValue prop)
  const getDisplayValue = () => props.displayValue || getDisplayValueFor(props.value);

  // Returns the plain option label used when focused/searching (ignores displayValue override)
  const getLabelValue = () => getDisplayValueFor(props.value);

  // Initialize input with current value when blurred
  createEffect(() => {
    if (!isFocused() && props.value) {
      setInputValue(getDisplayValue());
    }
  });

  // Filter options based on input
  const filteredOptions = (): ComboboxOption<T>[] => {
    if (!showDropdown()) return props.options;

    // Show all options if input matches the COMMITTED selection (just opened, haven't typed)
    const committedDisplay = getDisplayValueFor(committedValue());
    if (inputValue() === committedDisplay) {
      return props.options;
    }

    // If input is empty (user cleared it), show all
    if (!inputValue()) {
      return props.options;
    }

    // Filter when user has typed something different
    const filterFn = props.filterFn || defaultFilterFn;
    return props.options.filter((opt) => filterFn(opt, inputValue()));
  };

  // Find the index of current value in ALL options (not filtered)
  const findCurrentIndex = (): number => {
    if (!props.value) return 0;
    const index = props.options.findIndex((opt) => opt.value === props.value);
    return index >= 0 ? index : 0;
  };

  // Setup floating UI for dropdown positioning
  const [reference, setReference] = createSignal<HTMLElement>();
  const [floating, setFloating] = createSignal<HTMLElement>();

  const position = useFloating(reference, floating, {
    placement: "bottom-start",
    middleware: [
      offset(4),
      flip(),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Handle input changes - typing always shows dropdown
  const handleInput = (e: InputEvent) => {
    const value = (e.target as HTMLInputElement).value;
    setInputValue(value);
    setShowDropdown(true);
    setHasInteracted(true); // Typing is an interaction
    setHighlightedIndex(0);
  };

  // Trigger preview when highlighting changes - ONLY in Mode 3 (dropdown visible)
  // Mode 2 commits immediately via arrow handler, doesn't use preview
  // Don't preview on initial open - only when user arrows around
  createEffect(() => {
    if (showDropdown() && props.onPreview && hasInteracted()) {
      const filtered = filteredOptions();
      const highlighted = filtered[highlightedIndex()];
      if (highlighted) {
        props.onPreview(highlighted.value);
      } else if (filtered.length === 0 && committedValue() !== undefined) {
        // No results - revert to committed value
        props.onPreview(committedValue() as T);
      }
    }
  });

  // Keyboard navigation - clean 3-mode logic
  const handleArrowKeys = (e: KeyboardEvent, delta: number) => {
    e.preventDefault();
    if (!isFocused()) return;

    const filtered = filteredOptions();

    // Mark that user has interacted (for preview triggering)
    setHasInteracted(true);

    // Calculate new index
    const newIndex = Math.max(0, Math.min(filtered.length - 1, highlightedIndex() + delta));
    setHighlightedIndex(newIndex);

    // In Mode 2b (quick-nav with no dropdown): Commit immediately
    if (!showDropdown()) {
      const selected = filtered[newIndex];
      if (selected && !selected.disabled) {
        props.onSelect(selected.value);
        setInputValue(selected.label);
        setCommittedValue(() => selected.value);
      }
    }
  };

  const handleEnterKey = (e: KeyboardEvent) => {
    e.preventDefault();
    if (!isFocused()) return;

    const filtered = filteredOptions();

    // Cmd+Enter or Ctrl+Enter: Toggle dropdown (quick-nav mode)
    if (e.metaKey || e.ctrlKey) {
      // If closing dropdown (Mode 2a → 2b), commit the currently highlighted item
      if (showDropdown()) {
        const highlighted = filtered[highlightedIndex()];
        if (highlighted && !highlighted.disabled) {
          props.onSelect(highlighted.value);
          setInputValue(highlighted.label);
          setCommittedValue(() => highlighted.value);
        }
      }
      setShowDropdown(!showDropdown());
      return;
    }

    // Regular Enter: Select highlighted item
    if (showDropdown()) {
      const selected = filtered[highlightedIndex()];
      if (selected && !selected.disabled) {
        props.onSelect(selected.value);
        setInputValue(selected.label);
        setShowDropdown(false);
        setHasInteracted(false);
        setIsFocused(false);
        setCommittedValue(() => selected.value);
        inputRef?.blur();
      }
    }
  };

  const handleEscapeKey = (e: KeyboardEvent) => {
    e.preventDefault();
    // Always fully blur on Escape (Mode 3 or Mode 2 → Mode 1)
    setShowDropdown(false);
    setIsFocused(false);
    setHasInteracted(false);
    setInputValue(getDisplayValue());

    // Revert any preview changes
    if (committedValue() !== undefined) {
      if (props.onPreview) {
        props.onPreview(committedValue() as T);
      }
      if (committedValue() !== props.value) {
        props.onSelect(committedValue() as T);
      }
    }

    inputRef?.blur();
  };

  const handleTabKey = () => {
    // Always blur on Tab
    setIsFocused(false);
    setShowDropdown(false);
    setHasInteracted(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        handleArrowKeys(e, 1);
        break;
      case "ArrowUp":
        handleArrowKeys(e, -1);
        break;
      case "Enter":
        handleEnterKey(e);
        break;
      case "Escape":
        handleEscapeKey(e);
        break;
      case "Tab":
        handleTabKey();
        break;
    }
  };

  // Scroll highlighted option into view when dropdown is visible
  createEffect(() => {
    if (showDropdown() && listRef) {
      const highlightedEl = listRef.children[highlightedIndex()] as HTMLElement;
      highlightedEl?.scrollIntoView({ block: "nearest" });
    }
  });

  // Close on click outside
  const handleClickOutside = (e: MouseEvent) => {
    if (inputRef && !inputRef.contains(e.target as Node) && listRef && !listRef.contains(e.target as Node)) {
      setIsFocused(false);
      setShowDropdown(false);
      setHasInteracted(false);
      setInputValue(getDisplayValue());

      // Revert any preview changes (same as Escape)
      if (committedValue() !== undefined) {
        if (props.onPreview) {
          props.onPreview(committedValue() as T);
        }
        if (committedValue() !== props.value) {
          props.onSelect(committedValue() as T);
        }
      }
    }
  };

  createEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  // Size classes based on uiSize setting
  const sizeClasses = () => {
    const size = uiSize();
    return {
      input: size === "sm" ? "text-sm" : size === "md" ? "text-base" : "text-lg",
      option: size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
    };
  };

  return (
    <div class={props.class || "relative"}>
      {/* Input field */}
      <input
        ref={(el) => {
          inputRef = el;
          setReference(el);
        }}
        type="text"
        value={inputValue()}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          // Reset to plain label (not displayValue override) so typeahead matches correctly
          setInputValue(getLabelValue());
          setIsFocused(true);
          setHighlightedIndex(findCurrentIndex()); // Set index FIRST before dropdown shows
          setShowDropdown(true); // Then show dropdown
          e.currentTarget.select();
        }}
        onBlur={() => {
          setIsFocused(false);
          setShowDropdown(false);
        }}
        placeholder={props.placeholder}
        class={
          props.inputClass ||
          "w-full rounded-lg pl-4 pr-10 py-2 border transition-colors bg-surface-overlay border-border text-text-primary placeholder:text-text-muted focus:border-accent outline-none"
        }
        classList={{
          [sizeClasses().input]: true,
        }}
        role="combobox"
        aria-expanded={showDropdown()}
        aria-controls={listboxId}
        aria-activedescendant={
          isFocused() && filteredOptions()[highlightedIndex()] ? `${listboxId}-option-${highlightedIndex()}` : undefined
        }
        autocomplete="off"
      />

      {/* Dropdown icon */}
      <Show when={props.showIcon !== false}>
        <div
          class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted transition-transform"
          classList={{
            "rotate-180": showDropdown(),
          }}
        >
          <Show
            when={showDropdown() && props.iconOpen}
            fallback={
              <Show
                when={props.icon}
                fallback={
                  <Show
                    when={isFocused() && !showDropdown()}
                    fallback={
                      // Default chevron when not focused or when dropdown open
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    }
                  >
                    {/* Position indicator for Mode 2 (focused but closed) */}
                    <span class="text-xs font-mono tabular-nums">
                      {highlightedIndex() + 1}/{filteredOptions().length}
                    </span>
                  </Show>
                }
              >
                {props.icon}
              </Show>
            }
          >
            {props.iconOpen}
          </Show>
        </div>
      </Show>

      {/* Dropdown list - only show in mode 3 */}
      <Show when={showDropdown() && filteredOptions().length > 0}>
        <div
          ref={(el) => {
            listRef = el;
            setFloating(el);
          }}
          id={listboxId}
          role="listbox"
          class={
            props.dropdownClass ||
            "absolute rounded-xl border shadow-xl overflow-y-auto bg-surface-overlay border-border"
          }
          style={{
            position: position.strategy,
            top: `${position.y ?? 0}px`,
            left: `${position.x ?? 0}px`,
            "max-height": props.maxHeight || "20rem",
            "z-index": baseZIndex,
          }}
        >
          <For each={filteredOptions()}>
            {(option, index) => (
              <div
                id={`${listboxId}-option-${index()}`}
                role="option"
                tabIndex={-1}
                aria-selected={highlightedIndex() === index()}
                class="px-3 py-2 cursor-pointer transition-colors"
                classList={{
                  [sizeClasses().option]: true,
                  "bg-gradient-from/30 text-text-primary": highlightedIndex() === index(),
                  "hover:bg-surface-raised": highlightedIndex() !== index(),
                  "opacity-50 cursor-not-allowed": option.disabled,
                }}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent focus shift that would trigger blur before onClick
                  e.stopPropagation(); // Prevent click from bubbling to parent containers
                }}
                onClick={() => {
                  if (!option.disabled) {
                    props.onSelect(option.value);
                    setInputValue(option.label);
                    setShowDropdown(false);
                    setHasInteracted(false);
                    setCommittedValue(() => option.value);
                    setIsFocused(false);
                    inputRef?.blur(); // Fully close (mode 1)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!option.disabled) {
                      props.onSelect(option.value);
                      setInputValue(option.label);
                      setShowDropdown(false);
                      setCommittedValue(() => option.value);
                      inputRef?.focus();
                    }
                  }
                }}
                onMouseEnter={() => {
                  setHasInteracted(true);
                  setHighlightedIndex(index());
                }}
              >
                {(props.renderOption || renderHorizontal)(option, highlightedIndex() === index())}
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* No results message - only show in mode 3 */}
      <Show when={showDropdown() && filteredOptions().length === 0}>
        <div
          ref={setFloating}
          class="absolute rounded-xl border shadow-xl px-4 py-3 bg-surface-overlay border-border text-text-muted"
          style={{
            position: position.strategy,
            top: `${position.y ?? 0}px`,
            left: `${position.x ?? 0}px`,
            "z-index": baseZIndex,
          }}
          classList={{
            [sizeClasses().option]: true,
          }}
        >
          {props.noResultsMessage || "No results found"}
        </div>
      </Show>
    </div>
  );
};

export default Combobox;
