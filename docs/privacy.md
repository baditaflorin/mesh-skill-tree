# Privacy threat model — mesh-skill-tree

This tool depends on people self-rating honestly. The trust contract is "the room sees only the aggregate radar; never individual ratings."

## What other peers in the same room can see

- The shared **skills list** (`Y.Array<string>`).
- The shared **ratings map** (`Y.Map<peerId, Record<string, 1|2|3|4>>`), keyed by `peerId`.

Technically peers receive each others' rows over WebRTC; the UI never renders them. `peerId` is a `crypto.randomUUID()` persisted to localStorage, not tied to your name, IP, or any other identifier.

See [ADR 0002](adr/0002-radar-with-mentor-overlay.md) and [ADR 0003](adr/0003-self-rating-only.md) for why the per-peer entries exist (for edit-in-place semantics and the same-peer constraint) and why nothing aggregates across peers in the UI beyond means and counts.

## What stays local

- Your `peerId` (in localStorage).
- Your room ID and infra overrides (also localStorage).

## What the signaling server sees

`signaling-server` (https://github.com/baditaflorin/signaling-server) sees:

- The **room name** (`mesh-skill-tree:<roomId>`).
- Encrypted SDP blobs relayed between peers.
- The IP address of each peer's WebSocket connection.

It does **not** see ratings — those flow peer-to-peer over WebRTC DataChannel after SDP exchange completes.

## What the TURN server sees

`coturn-hetzner` (https://github.com/baditaflorin/coturn-hetzner) relays encrypted WebRTC data when peers can't connect directly:

- IP addresses of the two relayed peers.
- Encrypted DTLS / DataChannel bytes. It cannot decrypt them.

## Permissions asked

None. No camera, microphone, motion, or notifications.

## Caveats

- **`peerId` to IP correlation.** Any peer with packet-capture tooling could correlate the `peerId` in the Yjs map with the IP address on the WebRTC channel. Not meaningful inside a trusted team room; out of scope for v1.
- **Trust boundary is the client.** The aggregate-only render is enforced by the React component, not the protocol. Same trade-off as the rest of the Mode A app collection — see [ADR 0001](adr/0001-deployment-mode.md).
- **Not an HR record.** Self-ratings have known biases (Dunning-Kruger, gender effects, cultural effects). The radar is a fast snapshot of how the team sees itself, not an objective skill measurement.
