export const appConfig = {
  appName: "mesh-skill-tree",
  storagePrefix: "mesh-skill-tree",
  description:
    "Peer-to-peer mesh: anonymous team skill radar. Self-rate 8-12 skills 1-4; team gets aggregate radar chart with no individual data.",
  accentHex: "#6cf09b",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl: "https://github.com/baditaflorin/mesh-skill-tree",
  pagesUrl: "https://baditaflorin.github.io/mesh-skill-tree/",
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
  paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
} as const;
