// ABOUTME: Minimal shared styling tokens for card surfaces and dividers
// ABOUTME: Only abstracts what truly changes for the same reasons (visual card identity)

/**
 * Design system styling tokens.
 *
 * Philosophy: Only share what changes for the same reason.
 * - Card surface identity: background, border style, shadow
 * - NOT layout: padding, flex direction, spacing (component-specific)
 *
 * The litmus test: "If rebranding tomorrow, what would you search-and-replace?"
 * THAT's what should be here.
 */

/**
 * The elevated card surface - this is what makes a card look like a card
 * Changes when: Rebranding, design system updates, elevation changes
 * Used by: Message bubbles, demo cards, dialogs, popovers, panels
 */
export const cardSurface = "bg-surface-raised border border-border shadow-lg";

/**
 * Flat card surface variant (no shadow)
 * Changes when: Same as cardSurface
 * Used by: Cards that need to feel less elevated
 */
export const cardSurfaceFlat = "bg-surface-raised border border-border";

/**
 * Border color for dividers and separators
 * Changes when: Design system color updates
 * Used by: Headers, section dividers, separators
 *
 * Note: Components control direction (border-b, border-t, etc.)
 */
export const borderColor = "border-border";
