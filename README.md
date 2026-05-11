# mesh-skill-tree

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--skill--tree-3ec47a?style=flat-square)](https://baditaflorin.github.io/mesh-skill-tree/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-skill-tree?style=flat-square&color=3ec47a)](https://github.com/baditaflorin/mesh-skill-tree/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-1a160a?style=flat-square)](docs/adr/0001-deployment-mode.md)

> Anonymous team skill radar. Self-rate 8–12 skills 1–4; the team sees an aggregate radar chart with no individual data.

**Live:** https://baditaflorin.github.io/mesh-skill-tree/

A team-meeting tool that produces a one-glance picture of where the team is strong, where it's thin, and — separately — where there's enough depth to mentor. Each engineer rates themselves 1 ("no exposure") to 4 ("could mentor others") on each skill in a shared list. The room renders a radar chart with two overlays: the per-skill average (solid polygon) and the per-skill mentor count as a share of respondents (dotted polygon). Individual ratings are never displayed.

The mentor-count overlay is the load-bearing decision here. Averages alone produce the same shape for "five people who are barely competent" and "one mentor plus four novices" — but those are very different team situations. Mentor share separates them visually.

## How it works

- One Yjs document per room. `Y.Array<string>("skills")` is the shared list; `Y.Map<peerId, Record<string, 1|2|3|4>>("ratings")` holds the self-ratings.
- `peerId` is `crypto.randomUUID()` persisted to localStorage, so reloads don't create duplicate respondents.
- Radar SVG uses `viewBox="-110 -110 220 220"`, equally-spaced vertices, scaled by rating/4 for averages and by mentors/respondents for the mentor overlay.
- "Copy radar as SVG" serializes the live `<svg>` element into the clipboard.

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). Per-peer entries exist in the Yjs map (peers see them on the wire) but are never rendered. The aggregate-only render is the user-visible trust contract.

## Architecture

- **Mode A** — pure GitHub Pages.
- **WebRTC** — Yjs + y-webrtc with self-hosted signaling and TURN.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-skill-tree.git
cd mesh-skill-tree
npm install
npm run dev
```

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                      |
| ---------------------------------------------------------------------- | -------------------------------------- | ------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds           |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                |

## ADRs

- [0001 — Deployment mode](docs/adr/0001-deployment-mode.md)
- [0002 — Radar from averages, plus mentor-count overlay](docs/adr/0002-radar-with-mentor-overlay.md)
- [0003 — Self-rating, not peer-rating](docs/adr/0003-self-rating-only.md)
- [0010 — GitHub Pages publishing](docs/adr/0010-pages-publishing.md)

## License

[MIT](LICENSE) © 2026 Florin Badita
