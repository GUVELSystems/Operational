# GUVEL Operational — Phase 3.1.F
## Ring size, Full Screen cleanup, cursor performance, two themes only

Base: Phase 3.1.E

### 1. OEE ring percentage, smaller still
Reduced from 30px to 25px, with clear room to the rings on every side.

### 2. Full Screen: buttons hide, cursor comes back
Two problems, one cause: the custom cursor dot lives outside the machine dashboard panel, so once
native Full Screen isolates that panel's rendering, the dot became invisible — with the native
cursor already turned off everywhere else in the app, that meant no cursor at all while in Full
Screen. Fixed together:
- While in native Full Screen, the panel now uses the regular system cursor throughout (`:fullscreen`
  restores it), so the pointer is always visible.
- The **Full Screen** and **Close** buttons hide themselves while Full Screen is active — Esc
  already exits it, and once it exits, the buttons reappear and the custom cursor takes back over.

### 3. General responsiveness
Two real causes found and fixed:
- The custom cursor was moving on every single `mousemove` event by writing `style.left`/`style.top`
  — properties that force the browser to recompute layout on every update, potentially hundreds of
  times a second. It now coalesces to once per animation frame and moves with a `transform`
  instead, which the browser can handle without recomputing layout at all. This is what made the
  cursor itself feel like it was sticking.
- A `MutationObserver` installed to reposition the Dashboard's filter popover was watching the
  *entire page* for *any* DOM change — meaning it fired on every chart redraw, every table refresh,
  everywhere in the app, whether or not the popover was even open. Removed; the resize/scroll
  handlers already next to it cover repositioning in the cases that matter.

### 4. Two themes only
The theme button now only ever shows Navy or Light — no third "system" state to click through.
The very first time someone opens the app (nothing saved yet), it still starts from whichever the
operating system prefers, but that's a one-time default, not a mode the button cycles back to.

### Files
`js/app.js`, `css/style.css`, `index.html` (cache keys `style.css?v=3.1.F`, `app.js?v=GUVEL-UI27`).
No SQL changes.

### Validation
`node --check js/app.js` passes.
- Theme button cycles light → dark → light → dark, never a third state.
- OEE ring percentage confirmed at 25px via computed style.
- Full Screen CSS rules (hide actions, restore cursor) confirmed present in the stylesheet.
- Regression: 12 screens across widths (1920–360px), both themes: no JavaScript errors, no
  horizontal overflow.
