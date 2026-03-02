// ABOUTME: Reusable Checkbox component with label and keyboard support
// ABOUTME: Follows design system patterns with theme CSS variables and accessibility features

import { type Component, createUniqueId, splitProps } from "solid-js";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
  [key: `data-ph-capture-attribute-${string}`]: string | undefined;
}

const Checkbox: Component<CheckboxProps> = (allProps) => {
  const [props, dataAttrs] = splitProps(allProps, ["checked", "onChange", "label", "disabled", "id"]);
  const checkboxId = () => props.id || createUniqueId();

  const handleChange = () => {
    if (props.disabled) return;
    props.onChange(!props.checked);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleChange();
    }
  };

  return (
    <label
      for={checkboxId()}
      class={`flex items-center gap-2 select-none ${props.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={handleChange}
      onKeyDown={handleKeyDown}
      {...dataAttrs}
    >
      <div class="relative flex items-center justify-center pointer-events-none">
        <input
          type="checkbox"
          id={checkboxId()}
          checked={props.checked}
          disabled={props.disabled}
          onChange={handleChange}
          class="sr-only"
        />
        <div
          class={`
            w-5 h-5 rounded border-2 flex items-center justify-center
            transition-all duration-200
            ${props.checked ? "bg-accent border-accent" : "bg-surface border-border"}
            ${!props.disabled && "hover:brightness-110"}
          `}
        >
          {props.checked && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="text-text-on-accent"
              aria-hidden="true"
            >
              <path
                d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
      <span class="text-sm text-text-primary">{props.label}</span>
    </label>
  );
};

export default Checkbox;
