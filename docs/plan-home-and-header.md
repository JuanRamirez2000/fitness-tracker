# Plan: one week strip on Home, carousels that stop hiding, a shorter phone header

Status: proposed 2026-11-18, not built. Builds on the five-tab layout (`docs/plan-training-split.md`).

## 1. Home: one week strip instead of four copies of today

### The problem

Today's session shows up in five places on Home:

1. The "Next · Today" tile.
2. The plan card's "Next: Wed Base · 53 min".
3. Plan vs done, in today's row.
4. The 7-day planner, in today's row.
5. The training summary's "Next up" list.

Plan vs done covers Monday to Sunday and the planner covers today plus six days, so on a Wednesday the same five days appear twice, one card apart.

### The change

Plan vs done and the planner become one **week strip**: seven rows, Monday to Sunday of the picked week.

| Day | What its row shows |
| --- | --- |
| Before today | What was planned and what you did: ✓ done (with the activity, tap to open it), ✗ missed, or a rest day |
| Today | Highlighted. The plan's session, or a suggestion, plus the forecast |
| After today | The plan's sessions, suggestions ("+ Suggested · Easy run 30 min") and the forecast. The owner gets "Plan a workout" and "Send to watch" as now |

The header line keeps the totals from both cards: "2 of 4 sessions · 1.4 of 3.2 h planned · Base, 20 weeks to Lake Perris".

**Looking past Sunday.** The week picker can go one week forward. Next week's strip shows the plan and suggestions, with forecast on the days it reaches. Until now the picker stopped at the current week. On a Saturday, next week is one tap away instead of the planner quietly spilling into it.

**What else changes**

- The plan card loses its "Next:" line. The tile above already says it.
- The training summary keeps its four sentences but drops its "Next up" list, because the strip shows those sessions. That's no change to Gemini usage, since it's the same single call.
- The "Next · Today" tile stays. Tapping it scrolls to today's row.

Today then shows twice: once as the tile at a glance, once as the row with the detail.

## 2. Moving things around

### Home, top to bottom

1. **Week so far** tiles (unchanged).
2. **How's the week going?**: the weekly review moves up from below the carousel. It's the one thing that reads the whole week for you, and today it's below a swipe.
3. **What's next?**: the training summary's four sentences, then the week strip.
4. **Plans and records**: the carousel, now only each plan's progress card and the week's records.

### Every tab: a grid on desktop, a swipe on the phone

From a laptop width (`lg`) up, each carousel lays its views out side by side, so nothing sits off-screen. On a phone it stays a swipe, with the named chips above. A phone has no room for a grid, and the chips say what's there.

| Tab | The views | Desktop arrangement |
| --- | --- | --- |
| Home | Each plan, records | 2 or 3 across |
| Training | Easy vs hard, HR zones, what sessions trained, bricks | 2 × 2 |
| Recovery | Today's readiness, last night's sleep, the week's mornings, the week's moods | 2 × 2, readiness first |
| Weight | Weight trend, goal projection, weekly loss vs plan | Trend full width, the other two side by side under it |
| Log | One coverage view per kind of data | Small multiples, 3 across |

On a phone, Recovery's carousel opens on today's readiness, and Weight's on the trend. Those are the ones you check most.

## 3. The phone header

### The problem

On a phone the sticky header stacks four rows:

1. The name and username.
2. Log feel, Refresh, Settings, the theme toggle and Lock.
3. The week picker.
4. The tabs.

That's about 230 px of an 812 px screen, so more than a quarter of every scroll is header.

### The change (below `lg` only; the desktop header is already one row)

```
┌──────────────────────────────────────────┐
│ Tracker      ‹  Nov 16 – 22  ›   ✎•   ⋯ │  row 1: name, compact week picker, Log feel, menu
│ Home  Training  Recovery  Weight  Log    │  row 2: tabs, scrolling sideways
└──────────────────────────────────────────┘
```

- **Row 1** holds the name, then a compact week picker ("‹ Nov 16 – 22 ›"; "This week" moves into the picker's own label), then Log feel as an icon with its "not logged yet" dot, then a **⋯** menu.
- **The ⋯ menu** holds Refresh, Settings, the theme toggle, and Lock or Edit. Refresh shows its progress on the ⋯ button while it runs.
- **The username** is dropped on phones.
- **Height** comes to about 96 px, under half of today's.

Log feel stays outside the menu because it's the one daily action and its dot is a reminder. Your "no hidden content" rule is about content, not controls, but the menu does put four actions one tap away.

**Alternative:** tabs in a bottom bar, where the thumb reaches. That leaves just row 1 at the top. The catch is that it collides with the floating "On this page" button and adds a second bar to the screen. The two-row header is the simpler change.

## Build order

1. Phone header (self-contained, `components/app-header.tsx`).
2. Carousel grid on desktop (`components/ui/focus-carousel.tsx` plus each tab's arrangement).
3. Week strip: merge `PlanCard` and `WeekPlanner`, let the week picker go one week ahead, and drop the "Next:" and "Next up" copies.
4. Move the weekly review and summary on Home.
5. Check phone and desktop in both themes, then push.

## Decisions for the owner

- **Week strip:** the picked week Monday to Sunday plus a next-week step in the picker (recommended), or a rolling "this week so far + the next 7 days" strip. The rolling one can run to 13 rows on a Sunday.
- **Carousels:** grid on desktop and swipe on phone (recommended), or drop the carousels everywhere and stack the views.
- **Phone header:** two rows with a ⋯ menu (recommended), or a bottom tab bar.
