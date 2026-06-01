import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { createRoomSync, type RoomSync } from "../sync/yjsRoom";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";

type Rating = 1 | 2 | 3 | 4;
type Ratings = Record<string, Rating>;

type Props = {
  roomId: string;
  peerId: string;
};

const DEFAULT_SKILLS = [
  "frontend",
  "backend",
  "databases",
  "infra/devops",
  "security",
  "data/ml",
  "design",
  "product/strategy",
  "writing",
  "debugging",
];

export function SkillTree({ roomId, peerId }: Props) {
  const [armed, setArmed] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [allRatings, setAllRatings] = useState<Map<string, Ratings>>(new Map());
  const [my, setMy] = useState<Ratings>({});
  const [peers, setPeers] = useState(0);
  const [copied, setCopied] = useState(false);

  const room = useMemo<RoomSync | null>(() => {
    if (!armed) return null;
    return createRoomSync(roomId);
  }, [armed, roomId]);

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      room?.provider?.destroy();
    };
  }, [room]);

  const skillsArrayRef = useRef<Y.Array<string> | null>(null);
  const ratingsMapRef = useRef<Y.Map<Ratings> | null>(null);

  useEffect(() => {
    if (!room) return;
    const doc = room.doc;
    const ySkills = doc.getArray<string>("skills");
    const yRatings = doc.getMap<Ratings>("ratings");
    skillsArrayRef.current = ySkills;
    ratingsMapRef.current = yRatings;

    doc.transact(() => {
      if (ySkills.length === 0) {
        ySkills.push([...DEFAULT_SKILLS]);
      }
    });

    // Two peers can both seed DEFAULT_SKILLS before the docs sync (each sees an
    // empty array on init), merging to a duplicated list. Collapse duplicates
    // convergently: every peer runs the same deterministic pass against the
    // same replicated array, so they all settle on the same unique, ordered
    // list. Idempotent — once deduped, no further deletes fire.
    const dedupeSkills = () => {
      const arr = ySkills.toArray();
      const seen = new Set<string>();
      const dupIdx: number[] = [];
      arr.forEach((s, i) => {
        if (seen.has(s)) dupIdx.push(i);
        else seen.add(s);
      });
      if (dupIdx.length === 0) return;
      doc.transact(() => {
        // Delete from the back so earlier indices stay valid.
        for (let i = dupIdx.length - 1; i >= 0; i--) {
          ySkills.delete(dupIdx[i]!, 1);
        }
      });
    };
    dedupeSkills();

    const refreshSkills = () => {
      dedupeSkills();
      setSkills(ySkills.toArray());
    };
    const refreshRatings = () => {
      const next = new Map<string, Ratings>();
      yRatings.forEach((v, k) => next.set(k, v));
      setAllRatings(next);
    };
    refreshSkills();
    refreshRatings();
    ySkills.observe(refreshSkills);
    yRatings.observe(refreshRatings);

    const own = yRatings.get(peerId);
    if (own) setMy(own);

    const awareness = room.provider?.awareness;
    const updatePeerCount = () => {
      setPeers(awareness ? awareness.getStates().size : 1);
    };
    awareness?.on("change", updatePeerCount);
    updatePeerCount();

    return () => {
      ySkills.unobserve(refreshSkills);
      yRatings.unobserve(refreshRatings);
      awareness?.off("change", updatePeerCount);
    };
  }, [room, peerId]);

  function setRating(skill: string, rating: Rating) {
    const yRatings = ratingsMapRef.current;
    if (!yRatings) return;
    setMy((prev) => {
      const next = { ...prev, [skill]: rating };
      yRatings.set(peerId, next);
      return next;
    });
  }

  function addSkill(raw: string) {
    const ySkills = skillsArrayRef.current;
    if (!ySkills) return;
    const t = raw.trim();
    if (!t) return;
    if (ySkills.toArray().includes(t)) return;
    if (ySkills.length >= 16) return; // radar starts to break down past ~16
    ySkills.push([t]);
  }
  function removeSkill(skill: string) {
    const ySkills = skillsArrayRef.current;
    const yRatings = ratingsMapRef.current;
    if (!ySkills || !yRatings) return;
    const arr = ySkills.toArray();
    const idx = arr.indexOf(skill);
    if (idx >= 0) ySkills.delete(idx, 1);
    yRatings.forEach((v, k) => {
      if (skill in v) {
        const next = { ...v };
        delete next[skill];
        yRatings.set(k, next);
      }
    });
    setMy((prev) => {
      const next = { ...prev };
      delete next[skill];
      return next;
    });
  }
  function clearRatings() {
    const yRatings = ratingsMapRef.current;
    if (!yRatings) return;
    yRatings.doc?.transact(() => {
      yRatings.clear();
    });
    setMy({});
  }

  // Aggregates per skill
  const aggregates = useMemo(() => {
    return skills.map((s) => {
      let sum = 0;
      let count = 0;
      let mentors = 0;
      allRatings.forEach((rs) => {
        const r = rs[s];
        if (r === 1 || r === 2 || r === 3 || r === 4) {
          sum += r;
          count += 1;
          if (r === 4) mentors += 1;
        }
      });
      const avg = count > 0 ? sum / count : 0;
      return { skill: s, avg, mentors, count };
    });
  }, [skills, allRatings]);

  async function copySvg() {
    const svg = document.querySelector(".skill-radar-svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const text = serializer.serializeToString(svg);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  if (!armed) {
    return (
      <div className="skill-arm">
        <h1>mesh-skill-tree</h1>
        <p>
          Self-rate 8–12 skills from 1 to 4. The room sees a radar of team averages and a dotted
          overlay of mentor counts — never your individual ratings.
        </p>
        <button type="button" className="skill-arm-button" onClick={() => setArmed(true)}>
          Connect
        </button>
        <p className="skill-hint">
          Room <code>{roomId}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="skill-stage">
      <div className="skill-hud">
        <span>
          {peers} {peers === 1 ? "person" : "people"} here
        </span>
        <span>·</span>
        <span>{allRatings.size} responses</span>
        <span>·</span>
        <span>{skills.length} skills</span>
      </div>

      <Radar aggregates={aggregates} totalRespondents={allRatings.size} />

      <button type="button" className="skill-copy" onClick={copySvg}>
        {copied ? "Copied!" : "Copy radar as SVG"}
      </button>

      <section className="skill-self">
        <h2>Your private ratings</h2>
        <p className="skill-self-help">
          1 = no exposure · 2 = with help · 3 = comfortable solo · 4 = could mentor. Only the
          per-skill average and mentor count are shared.
        </p>
        {skills.map((s) => (
          <div className="skill-row" key={s}>
            <span className="skill-name">{s}</span>
            <div className="skill-buttons" role="group" aria-label={`Rate ${s}`}>
              {([1, 2, 3, 4] as Rating[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`skill-button${my[s] === r ? " skill-button-on" : ""}`}
                  onClick={() => setRating(s, r)}
                  aria-label={`Rate ${s} as ${r}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ))}

        <AddSkillInline onAdd={addSkill} />

        <details className="skill-manage">
          <summary>Manage skills</summary>
          <ul>
            {skills.map((s) => (
              <li key={s}>
                <span>{s}</span>
                <button type="button" onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="skill-danger" onClick={clearRatings}>
            Clear all ratings in this room
          </button>
        </details>
      </section>
    </div>
  );
}

function AddSkillInline({ onAdd }: { onAdd: (s: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="skill-add"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(v);
        setV("");
      }}
    >
      <input
        placeholder="Add a skill…"
        value={v}
        onChange={(e) => setV(e.target.value)}
        aria-label="Add a skill"
      />
      <button type="submit">Add</button>
    </form>
  );
}

type RadarRow = { skill: string; avg: number; mentors: number; count: number };

function Radar({
  aggregates,
  totalRespondents,
}: {
  aggregates: RadarRow[];
  totalRespondents: number;
}) {
  const n = aggregates.length;
  if (n < 3) {
    return (
      <div className="skill-radar-empty">
        Add at least 3 skills to draw the radar (currently {n}).
      </div>
    );
  }

  const R = 80; // outer radius in viewBox units
  const center = { x: 0, y: 0 };
  const angles = aggregates.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);

  // axis endpoints
  const axisPts = angles.map((a) => ({ x: Math.cos(a) * R, y: Math.sin(a) * R }));

  // average polygon: avg/4 * R
  const avgPts = aggregates.map((row, i) => {
    const r = (row.avg / 4) * R;
    return { x: Math.cos(angles[i]!) * r, y: Math.sin(angles[i]!) * r };
  });

  // mentor polygon: mentors/max(1,totalRespondents) * R (fraction of team who are mentors)
  const denom = Math.max(1, totalRespondents);
  const mentorPts = aggregates.map((row, i) => {
    const frac = row.mentors / denom;
    const r = frac * R;
    return { x: Math.cos(angles[i]!) * r, y: Math.sin(angles[i]!) * r };
  });

  const ptsToPath = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  // gridlines at 1, 2, 3, 4
  const grid = [1, 2, 3, 4].map((level) => {
    const pts = angles.map((a) => {
      const r = (level / 4) * R;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
    return ptsToPath(pts);
  });

  return (
    <div className="skill-radar-wrap">
      <svg
        className="skill-radar-svg"
        viewBox="-110 -110 220 220"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="team skill radar"
      >
        {grid.map((d, i) => (
          <polygon key={i} points={d} className="skill-radar-grid" />
        ))}
        {axisPts.map((p, i) => (
          <line
            key={i}
            x1={center.x}
            y1={center.y}
            x2={p.x}
            y2={p.y}
            className="skill-radar-axis"
          />
        ))}
        <polygon points={ptsToPath(avgPts)} className="skill-radar-avg" />
        <polygon points={ptsToPath(mentorPts)} className="skill-radar-mentor" />
        {axisPts.map((p, i) => {
          const labelR = 1.15;
          return (
            <text
              key={i}
              x={p.x * labelR}
              y={p.y * labelR}
              className="skill-radar-label"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {aggregates[i]!.skill}
            </text>
          );
        })}
      </svg>
      <div className="skill-radar-legend">
        <span className="skill-radar-legend-avg">━ avg (1–4)</span>
        <span className="skill-radar-legend-mentor">┄ mentor share</span>
      </div>
    </div>
  );
}
