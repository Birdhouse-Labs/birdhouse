// ABOUTME: CSS styling update diff sample
// ABOUTME: Shows modern CSS improvements with custom properties

import type { DiffSample } from "./types";

export const cssUpdate: DiffSample = {
  id: "css-update",
  name: "CSS Modernization",
  filePath: "button.css",
  description: "Update to CSS custom properties and modern syntax",
  before: `.button {
  background-color: #3b82f6;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.button:hover {
  background-color: #2563eb;
}

.button:active {
  background-color: #1d4ed8;
}

.button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.button-secondary {
  background-color: #64748b;
  color: white;
}

.button-secondary:hover {
  background-color: #475569;
}

.button-danger {
  background-color: #ef4444;
  color: white;
}

.button-danger:hover {
  background-color: #dc2626;
}`,
  after: `:root {
  --button-radius: 6px;
  --button-padding: 0.5rem 1rem;
  --button-font-size: 0.875rem;
  --transition-speed: 0.2s;
  
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-primary-active: #1d4ed8;
  
  --color-secondary: #64748b;
  --color-secondary-hover: #475569;
  
  --color-danger: #ef4444;
  --color-danger-hover: #dc2626;
  
  --color-disabled: #94a3b8;
}

.button {
  background-color: var(--color-primary);
  color: white;
  padding: var(--button-padding);
  border: none;
  border-radius: var(--button-radius);
  font-size: var(--button-font-size);
  cursor: pointer;
  transition: background-color var(--transition-speed);
}

.button:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.button:active:not(:disabled) {
  background-color: var(--color-primary-active);
}

.button:disabled {
  background-color: var(--color-disabled);
  cursor: not-allowed;
}

.button-secondary {
  background-color: var(--color-secondary);
}

.button-secondary:hover:not(:disabled) {
  background-color: var(--color-secondary-hover);
}

.button-danger {
  background-color: var(--color-danger);
}

.button-danger:hover:not(:disabled) {
  background-color: var(--color-danger-hover);
}`,
};
