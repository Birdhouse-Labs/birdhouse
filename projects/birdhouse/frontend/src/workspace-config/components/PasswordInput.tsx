// ABOUTME: Reusable password input with show/hide toggle
// ABOUTME: Uses lucide-solid icons and follows design system styling patterns

import { Eye, EyeOff } from "lucide-solid";
import { type Component, createSignal } from "solid-js";

export interface PasswordInputProps {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  class?: string;
}

const PasswordInput: Component<PasswordInputProps> = (props) => {
  const [isVisible, setIsVisible] = createSignal(false);

  const toggleVisibility = () => {
    setIsVisible(!isVisible());
  };

  const handleInput = (e: InputEvent) => {
    const target = e.currentTarget as HTMLInputElement;
    props.onInput(target.value);
  };

  return (
    <div class={`relative ${props.class || ""}`}>
      <input
        type={isVisible() ? "text" : "password"}
        value={props.value}
        onInput={handleInput}
        placeholder={props.placeholder}
        disabled={props.disabled}
        class="w-full px-3 py-2 pr-10 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono"
      />
      <button
        type="button"
        onClick={toggleVisibility}
        disabled={props.disabled}
        aria-label={isVisible() ? "Hide password" : "Show password"}
        class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isVisible() ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

export default PasswordInput;
