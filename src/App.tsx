import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { SkillTree } from "./features/skill/SkillTree";
import { SettingsExtras } from "./features/settings/SettingsExtras";
import { appConfig } from "./shared/config";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  peerId: `${appConfig.storagePrefix}:peerId`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}

function ensurePeerId(): string {
  const existing = localStorage.getItem(STORAGE.peerId);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(STORAGE.peerId, fresh);
  return fresh;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [peerId] = useState(() => ensurePeerId());

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);

  return (
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={<SettingsExtras />}
    >
      <SkillTree roomId={roomId} peerId={peerId} />
    </MeshShell>
  );
}
