---
status: accepted
date: 2026-05-12
---

# 0002 — Radar from averages, plus mentor-count overlay

## Context

The radar chart is the whole UI. Whatever it plots is what the team will reason about. The naive choice — plot the mean self-rating per skill — has a known failure mode: two teams with the same mean shape can have wildly different ability to teach. A skill with five people rated "2" has the same mean as a skill with one "4" and four "1.5"s, but one of those teams can grow into the skill and the other can't.

Mentoring capacity (rating "4") is what makes a skill self-improving. Surfacing it is the difference between a chart that decorates a meeting and a chart that changes a hiring plan.

## Decision

Plot **two polygons** in the same radar:

1. **Solid polygon** — per-skill **average** rating, scaled by `avg/4 * R` where R is the outer radius. This is the team's current depth.
2. **Dotted polygon** — per-skill **mentor share**, computed as `count_of_4_ratings / total_respondents`, scaled by that fraction × R. This is the team's ability to grow that skill internally.

Both polygons share the same axes, the same orientation, and the same SVG. A legend below the chart labels them.

The mentor polygon uses _share_ (fraction of respondents who rated themselves 4), not absolute count, because the chart needs to make sense for teams of any size — three mentors out of three respondents should fill the axis; three out of fifty should not.

## Consequences

- **Pros.** The two failure modes — thin team and shallow team — produce visually distinct shapes. A skill with high average but zero mentor share is _competent but un-mentorable_ (look outward for hiring); a skill with average 2 but one mentor is _growable_ (look inward for development).
- **Pros.** Both polygons come from the same `ratings` map; no extra protocol surface.
- **Cons.** Two overlays in the same chart is more visual load than one. We accept this — the mentor signal is too important to relegate to a secondary screen.
- **Cons.** "Mentor share" is sensitive to small teams. A team of 3 where 1 rates a skill as 4 produces a mentor share of 33% on that axis, which looks dramatic. The HUD shows respondent count to contextualize.

## Alternatives considered

- **Average only.** Rejected — masks the failure modes above.
- **Median only.** Rejected — collapses 1-2-3-3-3 and 1-1-3-4-4 to the same vertex, hiding mentor capacity.
- **Stacked bar chart per skill.** Rejected — loses the "shape of the team" gestalt that's the whole point of a radar.
- **Mentor count instead of share.** Rejected — doesn't generalize across team sizes; share is unit-free.
- **Mentor overlay as solid polygon with low opacity.** Rejected — overlapping solid fills made small differences hard to read. The dotted outline reads cleanly even when both polygons are close in shape.
