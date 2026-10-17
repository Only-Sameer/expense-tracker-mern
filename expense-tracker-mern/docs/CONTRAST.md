# Contrast review

Ratios below are calculated from the WCAG 2.x sRGB relative-luminance formula and rounded to two decimals. They cover primary theme token combinations, not every browser-composited state or chart-tooltip component. Verify actual rendered controls in axe/contrast tooling before launch.

| Theme | Foreground | Background | Ratio | Purpose / target |
|---|---|---|---:|---|
| Light | `#172033` | `#f7f8fc` | 15.33:1 | Normal text; AA pass |
| Light | `#172033` | `#ffffff` | 16.27:1 | Normal text; AA pass |
| Light | `#526079` | `#f7f8fc` | 5.98:1 | Normal text; AA pass |
| Light | `#526079` | `#ffffff` | 6.35:1 | Normal text; AA pass |
| Light | `#ffffff` | `#285fce` | 5.80:1 | Normal text on primary button; AA pass |
| Light | `#285fce` | `#ffffff` | 5.80:1 | Link on surface; AA pass |
| Light | `#808ca3` | `#ffffff` | 3.39:1 | Non-text UI boundary; AA pass |
| Light | `#808ca3` | `#f7f8fc` | 3.19:1 | Non-text UI boundary; AA pass |
| Dark | `#f2f5fb` | `#111827` | 16.24:1 | Normal text; AA pass |
| Dark | `#f2f5fb` | `#1c2638` | 13.90:1 | Normal text; AA pass |
| Dark | `#c0cada` | `#111827` | 10.73:1 | Normal text; AA pass |
| Dark | `#c0cada` | `#1c2638` | 9.18:1 | Normal text; AA pass |
| Dark | `#101827` | `#8db4ff` | 8.55:1 | Normal text on primary button; AA pass |
| Dark | `#8db4ff` | `#1c2638` | 7.30:1 | Link on surface; AA pass |
| Dark | `#64728a` | `#1c2638` | 3.12:1 | Non-text UI boundary; AA pass |
| Dark | `#64728a` | `#111827` | 3.65:1 | Non-text UI boundary; AA pass |
| Light | `#172033` | `#eef2f9` | 14.49:1 | Primary text on hover/category surface; AA pass |
| Light | `#526079` | `#eef2f9` | 5.65:1 | Muted text on hover/category surface; AA pass |
| Light | `#285fce` | `#f7f8fc` | 5.47:1 | Links on page background; AA pass |
| Light | `#1e4da8` | `#ffffff` | 7.83:1 | Hovered links/buttons; AA pass |
| Light | `#176b45` | `#f7f8fc` | 6.13:1 | Success text on page background; AA pass |
| Light | `#b42318` | `#f7f8fc` | 6.19:1 | Error/destructive text on page background; AA pass |
| Dark | `#f2f5fb` | `#273449` | 11.49:1 | Primary text on hover/category surface; AA pass |
| Dark | `#c0cada` | `#273449` | 7.59:1 | Muted text on hover/category surface; AA pass |
| Dark | `#8db4ff` | `#111827` | 8.54:1 | Links on page background; AA pass |
| Dark | `#b0cbff` | `#1c2638` | 9.27:1 | Hovered links on surface; AA pass |
| Dark | `#8be0b6` | `#111827` | 11.35:1 | Success text on page background; AA pass |
| Dark | `#ff9b91` | `#111827` | 8.74:1 | Error/destructive text on page background; AA pass |
| Dark | `#101827` | `#ff9b91` | 8.76:1 | Dark destructive-button foreground; AA pass |
| Light | `#ffffff` | `#1e4da8` | 7.83:1 | Primary button hover; AA pass |
| Light | `#b42318` | `#fff0ee` | 5.93:1 | Error text on error background; AA pass |
| Light | `#176b45` | `#ffffff` | 6.51:1 | Success text on surface; AA pass |
| Dark | `#101827` | `#b0cbff` | 10.86:1 | Primary button hover; AA pass |
| Dark | `#101827` | `#ff9b91` | 8.76:1 | Destructive button text; AA pass |
| Dark | `#ff9b91` | `#1c2638` | 7.48:1 | Error text on dark surface; AA pass |
| Dark | `#8be0b6` | `#1c2638` | 9.71:1 | Success text on dark surface; AA pass |

**Caveat:** this is a color-token audit, not proof that every rendered state meets WCAG 2.2 AA. Native form controls, chart gridlines/tooltips, disabled states, focus rings, error/success text, overlay dimming, and all hover/focus states must be checked visually and with a contrast checker.
