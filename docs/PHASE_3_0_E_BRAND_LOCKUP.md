# GUVEL Operational — Phase 3.0.E
## Top-left lockup matched to the reference image

Base: Phase 3.0.D

### Lockup
- Mark, then "GUVEL" (brand serif, bold) over "OPERATIONAL SYSTEM" (brand serif, regular, upper case),
  both in Ice `#EAF2F8` on the navy bar. The divider line from 3.0.C/3.0.D is removed.
- Proportions measured on the reference image and reproduced (mark height = H):

  | Ratio | Reference | Portal |
  |---|---|---|
  | Gap mark → text | 0.240 H | 0.254 H |
  | "GUVEL" cap height | 0.287 H | 0.291 H |
  | "GUVEL" width | 1.452 H | 1.450 H |
  | Tagline cap height | 0.089 H | 0.085 H |
  | Tagline width | 1.457 H | 1.476 H |
  | Gap between lines | 0.154 H | 0.148 H |
  | Text block vs mark center | −0.005 H | +0.005 H |

- Desktop: mark 64 px, top bar 72 px. Tablet (≤900 px): mark 44 px. Phone (≤520 px): mark 34 px, tagline hidden.

### Top bar fit
- The nav was being clipped (hidden scroll) between ~900 and 1400 px (for example "Settings" at 1280–1366 px).
- The company label now hides below 1400 px, and below 1180 px the nav moves to its own row under the lockup.
  Verified at 13 widths: no clipped nav between 1920 and 700 px; on phones the nav scrolls sideways as before.

Files: `index.html` (cache key `style.css?v=3.0.E`), `css/style.css`. No JS logic, no SQL.

### Validation
- Pixel measurement of the rendered lockup against the reference (table above).
- Regression: 7 screens × 7 widths (1920–360 px): no JavaScript errors, no horizontal overflow.
