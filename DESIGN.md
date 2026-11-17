# Design

The cockpit is a console-style dashboard. The reference is the Supabase dashboard: sidebar navigation, a slim top bar, bordered panels on a near-black or near-white ground, one green accent. It replaced an earlier "shelf-edge ticket" look, which the owner rejected as unfit for an official setting.

## Where the look lives

- `cockpit/src/theme.js` holds every colour, size and Ant Design component override. Change the look there, not in the pages.
- `cockpit/src/styles.css` holds layout only: grids, the stacked reward bar, the net-value bars, print rules.
- Components are Ant Design 5 (`Layout`, `Menu`, `Card`, `Statistic`, `Table`, `Tag`, `Progress`, `Select`, `Slider`, `Button`, `Descriptions`). Do not hand-roll a control that Ant Design already has.

## Colour

| Role | Dark | Light |
|---|---|---|
| Accent, success, "viewed" | `#3ecf8e` | `#0f8a5f` |
| Warning, "unviewed", Review tag | `#f0b429` | `#b26a00` |
| Error, loss, failed check | `#f2555a` | `#c9353b` |
| Info, option B | `#5aa9f5` | `#1d6fd6` |
| Page ground | `#121212` | `#f8f9f8` |
| Panel | `#1c1c1c` | `#ffffff` |
| Sidebar and top bar | `#161616` | `#ffffff` |
| Border | `#2a2a2a`, `#363636` | `#e6e8e6`, `#d6d9d6` |
| Text | `#ededed`, `#b4b4b4` secondary | `#171717`, `#4d524f` secondary |

Dark and light both ship. The choice follows `?theme=dark|light` in the link, then the viewer's saved toggle, then the system setting.

## Type

Inter Variable, self-hosted through `@fontsource-variable/inter`. Base size is 16px, one step above a typical console, because several viewers have poor eyesight and the tool is shown on a projector. Headline statistics are 32px. Nothing is set under 14px, and 14px is used only for denominators and field labels.

## Rules

- Every rate shows its denominator beneath it ("of 4,354").
- Colour never carries meaning alone. A flagged offer has a "Review" tag, a loss has a "Loss" tag, and unviewed reward is written in pounds beside its amber bar segment.
- Explanatory prose lives in the Notes page. Working pages carry labels and numbers. The one exception is the opt-in guided tour (`src/tour.jsx`), which lays a popover over each element it explains.
- Filters appear only on pages they affect.
- Radius is 6px. Panels have a 1px border and no shadow.
