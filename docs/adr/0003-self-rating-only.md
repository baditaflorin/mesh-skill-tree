---
status: accepted
date: 2026-05-12
---

# 0003 — Self-rating, not peer-rating

## Context

A team-skill radar can be sourced two ways: self-assessment, or 360-style peer ratings. Peer ratings are more accurate in principle (Dunning-Kruger is real and bidirectional), but they require an entirely different trust infrastructure: non-retaliation guarantees, identity unlinkability, an HR-grade audit trail, and usually a third party that owns the data and doles out aggregated reports. None of that fits a peer-to-peer party-app architecture where everyone in the room sees the same Yjs document over WebRTC.

The right move is to be honest about what kind of data the radar shows.

## Decision

The radar is sourced from **self-ratings only**. Each peer rates only their own row. There is no UI for rating other peers, no `target_peer_id` field in the data model, and no aggregation that crosses peers in either direction.

The README and the in-app help describe the radar as "a quick snapshot of how the team sees itself," not as a measure of skill.

## Consequences

- **Pros.** The data model is one-dimensional (peer → ratings) and trivially understood. There's no peer-to-peer rating to hide, no reveal phase, no commit-reveal commitments. The Mode A architecture is enough.
- **Pros.** People answer in front of their teammates without worrying about retaliation, because nobody else's data has their fingerprints on it.
- **Pros.** Cheap to redo. A team can re-run the exercise quarterly to see drift, with no historical data to manage.
- **Cons.** Self-assessment is biased. Senior people often under-rate themselves, juniors over-rate, both genders rate differently on average, and culture matters a lot. The aggregate **average** smooths some of this; the **mentor share** is the load-bearing signal in many of these cases (people who genuinely could mentor tend to know it).
- **Cons.** The radar is not suitable as an HR record or a performance input. The README states this explicitly to forestall accidental misuse.

## Alternatives considered

- **360 with Semaphore-style anonymous commit-reveal.** Considered. Rejected for v1 because the threat model is large enough to deserve its own app — see `anon-conf-poll` for the commit-reveal pattern. The mesh-skill-tree app would have to either solve the full 360 problem or punt some of it; punting is dishonest, solving it doubles the scope.
- **Self-rating plus optional anonymous peer comments.** Rejected as feature creep. Comments without ratings are useful but a different exercise; the radar should stay focused.
- **Bake the self-vs-peer distinction into the data model so a v2 could add 360 ratings later.** Considered. We chose to keep the v1 model minimal and revisit if a user actually asks for the v2; carrying schema for a feature that might never ship is its own complexity cost.
