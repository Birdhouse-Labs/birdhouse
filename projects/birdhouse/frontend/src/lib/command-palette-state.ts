// ABOUTME: Module-level signal controlling command palette open/close state
// ABOUTME: Kept separate from the component so any module can open the palette without circular imports

import { createSignal } from "solid-js";

const [isCommandPaletteOpen, setIsCommandPaletteOpen] = createSignal(false);

export { isCommandPaletteOpen, setIsCommandPaletteOpen };
