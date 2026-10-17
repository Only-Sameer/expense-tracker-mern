# Contrast review — Budgetry theme tokens

This table recalculates contrast ratios using the current CSS theme tokens with the WCAG 2.x sRGB relative-luminance formula. Text uses the 4.5:1 AA target; visible component boundaries use the 3:1 non-text target where that boundary is needed to identify a control.

| Theme / use | Foreground | Background | Ratio | Result |
|---|---|---|---:|---|
| Light primary text | #0F172A | #F8FAFC | 17.06:1 | AA |
| Light primary text on cards | #0F172A | #FFFFFF | 17.85:1 | AA |
| Light muted text | #475569 | #F8FAFC | 7.24:1 | AA |
| Light muted text on fields | #475569 | #F1F5F9 | 6.92:1 | AA |
| Light emerald accent | #047857 | #F8FAFC | 5.24:1 | AA |
| Light blue accent | #1D4ED8 | #FFFFFF | 6.70:1 | AA |
| Light warning text | #B45309 | #FFFFFF | 5.02:1 | AA |
| Light danger text | #B91C1C | #FEF2F2 | 5.91:1 | AA |
| Light control border | #7C8BA1 | #F8FAFC | 3.31:1 | Non-text pass |
| Light control border on card | #7C8BA1 | #FFFFFF | 3.46:1 | Non-text pass |
| Light control border on input | #7C8BA1 | #F1F5F9 | 3.16:1 | Non-text pass |
| Dark primary text | #F8FAFC | #0F172A | 17.06:1 | AA |
| Dark primary text on cards | #F8FAFC | #1E293B | 13.98:1 | AA |
| Dark muted text | #CBD5E1 | #0F172A | 12.02:1 | AA |
| Dark muted text on cards | #CBD5E1 | #1E293B | 9.85:1 | AA |
| Dark muted text on raised controls | #CBD5E1 | #334155 | 6.97:1 | AA |
| Dark emerald accent | #10B981 | #0F172A | 7.04:1 | AA |
| Dark emerald accent on cards | #10B981 | #1E293B | 5.77:1 | AA |
| Dark blue accent | #3B82F6 | #0F172A | 4.85:1 | AA |
| Dark warning accent | #F59E0B | #0F172A | 8.31:1 | AA |
| Dark danger accent | #EF4444 | #0F172A | 4.74:1 | AA |
| Dark control border | #8291A7 | #0F172A | 5.57:1 | Non-text pass |
| Dark control border on cards | #8291A7 | #1E293B | 4.57:1 | Non-text pass |
| Dark control border on raised controls | #8291A7 | #334155 | 3.23:1 | Non-text pass |
| Text on emerald primary button | #052E24 | #10B981 | 5.82:1 | AA |

## Scope and remaining checks

The light theme uses a darker border than the previous revision, and the dark theme uses a lighter border so form fields and card boundaries remain visible against their surfaces. These values are token-level calculations, not a claim that every browser-rendered component has passed WCAG 2.2 AA. Tinted category badges, disabled controls, custom-category colours, charts, tooltip states, focus indicators, overlay contrast, and actual hover/focus states still need browser-based checking with a contrast tool and axe. Charts include textual labels/legends, but a manual assistive-technology test is still needed.
