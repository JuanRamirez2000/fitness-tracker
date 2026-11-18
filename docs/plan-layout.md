# Layout plan: one training dashboard, a quick-look strip, fewer tabs

From the 2026-11-17 questionnaire. How much each area matters (0–10):

| Area | Score |
| --- | --- |
| Training | 10 |
| Progress | 9 |
| Weight | 9 |
| AI | 6 |
| Race | 5 |
| Daily feel | 3 |
| Mood | 2 |

Other answers:
- **Open first:** Progress.
- **Daily feel:** fold its readiness into Training and drop the tab.
- **Page length:** Training can stay long (4 of 5).
- **Detail:** in the middle (3 of 5).
- **Weight:** a weight line on Progress.

## 1. Tabs: Training (merged) and Weight

Daily feel goes. Training and Progress become one tab called **Training**, which opens first. Weight stays its own tab. The URL keeps working: `?tab=progress` and `?tab=today` open the merged tab.

The merged tab, top to bottom:

1. **Quick-look strip** (see 3).
2. **This week** (driven by the week picker):
   - The weekly review.
   - Plan progress cards.
   - Plan vs done.
   - Records this week.
   - A new weight card: this week's 7-day average against last week, with a small trend line.
3. **Next 7 days:** the week planner, with suggestions and the forecast.
4. **Recovery.** The pieces you kept from Daily feel:
   - Readiness ring and what drove it.
   - Sleep score and debt.
   - Body Battery.
   - Steps.
   - Insight cards.
   - The week's recovery and mood cards from Progress.
   - The mood chart, folded behind "Show the numbers" (you scored mood 2).
5. **Fitness** (driven by the range control):
   - Weekly volume and hours by sport.
   - VO2 max.
   - Training load and load focus.
   - HR zones and easy vs hard.
   - Session mix.
   - Bricks.
6. **Sport sections:**
   - Run: race predictions, efficiency, best efforts.
   - Ride: power curve, efficiency, power zones.
   - Swim: placeholder until January.
7. **Log:** activity calendar, records feed, activities table.

Two time controls on one page: the week picker sits in the "This week" header, and the range control (Week / Month / 6 months...) sits in the "Fitness" header. The app header keeps only the tabs, Log feel, Refresh and Settings.

## 2. What goes

| Card | Tab now | Why |
| --- | --- | --- |
| Engine trend | Training | not picked |
| What each session cost you | Training | not picked |
| Fat and lean mass, composition | Weight | not picked |
| Watts per kg insight | Weight | not picked |
| HRV and resting HR chart and cards | Daily feel | not picked |
| Sleep timing | Daily feel | not picked |
| Recovery calendar | Daily feel | not picked |

The code for these stays in the repo, so any of them can come back with one line.

## 3. Quick-look strip on every tab

A row of small cards, about half the height of today's KPI cards:
- On a phone it scrolls sideways and snaps card by card.
- On a desktop it wraps onto two rows.
- Every card is a link to the section behind it.

Mixed in:

| Card | What it shows |
| --- | --- |
| Readiness today | score + one word |
| Next session | "Thu Tempo ~38 min", from the plan or a suggestion |
| Plan | "Runna W1/12 · 10K 1:03:47 ▼" |
| This week | hours against 4–7 h, and sessions done / due |
| Load ratio | number + status |
| Weight | 7-day average + weekly rate |
| Sleep | last night's score + debt |
| Race | weeks to go + phase |

Same strip on Weight, so weight shows on Training and training on Weight.

## 4. AI summaries

The Daily feel summary goes, which saves a Gemini call a day. The free tier allows 20 a day.

The merged tab keeps:
- The weekly review at the top.
- The Training summary's "next sessions", shown under the planner.

Weight keeps its own summary.

## Build order

1. Merge the tabs, move the sections, and drop the listed cards. Redirect the old tab URLs.
2. Add the quick-look strip and the weight card.
3. Change the summaries: drop the Daily feel summary and update the cron.
4. Check desktop and phone layouts, then push.

## Decisions for the owner

- **Merge or not:** merge Training and Progress into one tab (recommended), or keep two tabs with Progress first.
- **Header:** whether to keep the range control in the header instead of in the Fitness section.
