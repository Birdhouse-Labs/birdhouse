# Known Console Warnings

This document tracks benign console warnings that are expected behavior and can be safely ignored.

## Firefox: WASM Source Map Warning

**Warning:**
```
Source map error: Error: URL constructor:  is not a valid URL.
Resource URL: wasm:http://localhost:50120/node_modules/.vite/deps/wasm-LV4RY2G7.js?v=f78a0bea line 7 > WebAssembly.instantiate
Source Map URL: null
```

**Cause:**
- Shiki syntax highlighting library uses `@shikijs/engine-oniguruma` (WASM-based regex engine)
- Vite bundles the WASM module as inline base64 in `wasm-LV4RY2G7.js`
- Firefox devtools tries to load sourcemaps for the WASM module instantiation
- WASM modules instantiated inline have no source URL, causing Firefox to pass empty string to URL constructor

**Impact:** None - Firefox-specific devtools quirk. Doesn't affect functionality, debugging, or end users.

**Why not fix:** 
- App works correctly
- Chrome/Edge don't show this warning
- The WASM binary itself isn't debuggable code
- Workarounds would complicate the build or disable useful sourcemaps

**First documented:** January 2026

---

## Firefox: Scroll-Linked Positioning Effect

**Warning:**
```
This site appears to use a scroll-linked positioning effect. This may not work well with asynchronous panning; see https://firefox-source-docs.mozilla.org/performance/scroll-linked_effects.html for further details and to join the discussion on related tools and features!
```

**Cause:**
- Firefox detects JavaScript or CSS that repositions elements based on scroll position
- Likely triggered by virtualized lists (`@tanstack/solid-virtual`) or sticky positioning in the UI
- Firefox's Asynchronous Panning and Zooming (APZ) optimizes scrolling on a separate thread
- Scroll-linked effects can interfere with this optimization

**Impact:** 
- Informational warning only - not an error
- No observed performance issues during normal usage
- Modern implementations (like Tanstack Virtual) are designed to work well with APZ
- Desktop performance is unaffected

**Why not fix:** 
- The warning is overly broad and triggers on legitimate UI patterns (virtualization)
- We use virtualized lists intentionally for performance with large message/tree lists
- Removing virtualization would hurt performance more than the warning helps
- No user reports of scroll jank or performance issues

**Investigation notes:**
- Not investigated in detail - decision made to ignore without deep investigation
- If users report scroll performance issues, revisit this decision

**First documented:** January 2026

---

**Template for future warnings:**
```
## [Browser/Context]: [Brief Title]

**Warning:**
```
[paste full warning text]
```

**Cause:** [technical explanation]

**Impact:** [what it affects, if anything]

**Why not fix:** [reasoning for ignoring]

**First documented:** [date]
```
