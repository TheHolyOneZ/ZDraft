import { GitMerge, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Pin, Sidecar } from "../core/sidecar/types";
import { api } from "../lib/tauri";
import { useDocumentStore } from "../store/useDocumentStore";
import { toast } from "../store/useToastStore";
import { Button, Modal, SegmentedControl } from "./ui";


type Side = "ours" | "theirs";

interface Row {
  id: string;
  ours?: Pin;
  theirs?: Pin;
}

function samePin(a: Pin | undefined, b: Pin | undefined): boolean {
  if (!a || !b) return false;
  return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);
}

export function ConflictDialog() {
  const conflict = useDocumentStore((s) => s.conflict);
  const name = useDocumentStore((s) => s.name);
  const resolveConflict = useDocumentStore((s) => s.resolveConflict);

  const [sides, setSides] = useState<{ ours: Sidecar; theirs: Sidecar } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, Side>>({});
  const [busy, setBusy] = useState(false);


  useEffect(() => {
    if (!conflict) {
      setSides(null);
      setFailed(null);
      return;
    }

    let cancelled = false;
    setChoice({});
    setFailed(null);

    void Promise.all([api.parseLayout(conflict.ours), api.parseLayout(conflict.theirs)])
      .then(([ours, theirs]) => !cancelled && setSides({ ours, theirs }))
      .catch((e) => {
        if (cancelled) return;
        setFailed(String((e as { message?: string })?.message ?? e));
      });

    return () => {
      cancelled = true;
    };
  }, [conflict]);


  const rows = useMemo<Row[]>(() => {
    if (!sides) return [];

    const ours = sides.ours.pins ?? {};
    const theirs = sides.theirs.pins ?? {};

    return [...new Set([...Object.keys(ours), ...Object.keys(theirs)])]
      .filter((id) => ours[id] && theirs[id] && !samePin(ours[id], theirs[id]))
      .sort()
      .map((id) => ({ id, ours: ours[id], theirs: theirs[id] }));
  }, [sides]);

  const merged = useMemo<Sidecar | null>(() => {
    if (!sides) return null;

    const pins: Record<string, Pin> = { ...(sides.ours.pins ?? {}), ...(sides.theirs.pins ?? {}) };
    for (const row of rows) {
      const side = choice[row.id] ?? "theirs";
      const pin = side === "ours" ? row.ours : row.theirs;
      if (pin) pins[row.id] = pin;
    }

    return {
      ...sides.theirs,


      edges: { ...(sides.ours.edges ?? {}), ...(sides.theirs.edges ?? {}) },
      pins,
    };
  }, [sides, rows, choice]);

  const apply = async (sidecar: Sidecar) => {
    setBusy(true);
    try {
      await resolveConflict(sidecar);
      toast.success("Conflict resolved", `${name}.zlayout.toml is clean again.`);
    } catch (e) {
      toast.error("Could not write the sidecar", String((e as { message?: string })?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (!conflict) return null;

  const ourLabel = conflict.ours_label || "yours";
  const theirLabel = conflict.theirs_label || "theirs";

  return (
    <Modal
      open


      onClose={() => void (merged && apply(merged))}
      title="This layout was merged by two people"
      description={`${name}.zlayout.toml still has conflict markers in it from line ${conflict.line}. Until one side is chosen, ZDraft will not write to it — so nothing you do here can lose either version.`}
      width={620}
      footer={
        <div className="flex w-full items-center gap-2">
          <Button
            onClick={() => void (sides && apply(sides.ours))}
            disabled={!sides || busy}
          >
            Keep only {ourLabel}
          </Button>
          <Button
            onClick={() => void (sides && apply(sides.theirs))}
            disabled={!sides || busy}
          >
            Keep only {theirLabel}
          </Button>

          <span className="flex-1" />

          <Button variant="primary" onClick={() => void (merged && apply(merged))} disabled={!merged || busy}>
            <GitMerge size={13} strokeWidth={1.75} />
            {busy ? "Writing…" : "Keep both"}
          </Button>
        </div>
      }
    >
      {failed ? (
        <p className="py-4 text-[12px]" style={{ color: "var(--error)" }}>
          One side of the conflict is not valid TOML, so ZDraft cannot offer a merge: {failed}.
          Resolve the markers in a text editor, or delete the sidecar to return to pure
          auto-layout.
        </p>
      ) : !sides ? (
        <p className="flex items-center gap-2 py-4 text-[12px]" style={{ color: "var(--text-3)" }}>
          <Loader2 size={13} strokeWidth={1.75} className="spin" />
          Reading both sides…
        </p>
      ) : (
        <>
          <p className="mb-3 text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            {rows.length === 0 ? (
              <>
                The two sides pinned <strong>different nodes</strong> and nothing was placed twice.
                Keeping both loses nothing.
              </>
            ) : (
              <>
                {rows.length} node{rows.length === 1 ? " was" : "s were"} pinned to different places
                on each side. Everything else merges cleanly.
              </>
            )}
          </p>

          {rows.length > 0 && (
            <div
              className="max-h-[300px] overflow-y-auto rounded-lg"
              style={{ border: "1px solid var(--border)" }}
            >
              {rows.map((row, i) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 px-3 py-2"
                  style={{ borderTop: i === 0 ? undefined : "1px solid var(--border)" }}
                >
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium" style={{ color: "var(--text)" }}>
                    {row.id}
                  </span>

                  <SegmentedControl<Side>
                    aria-label={`Which position for ${row.id}`}
                    size="sm"
                    value={choice[row.id] ?? "theirs"}
                    onChange={(side) => setChoice((c) => ({ ...c, [row.id]: side }))}
                    segments={[
                      { value: "ours", label: coords(row.ours) },
                      { value: "theirs", label: coords(row.theirs) },
                    ]}
                  />
                </div>
              ))}
            </div>
          )}

          <p className="mt-2 text-[11px]" style={{ color: "var(--text-3)" }}>
            Left is {ourLabel}; right is {theirLabel}. Whichever you pick, the source file is not
            touched — this is only about where things sit.
          </p>
        </>
      )}
    </Modal>
  );
}

function coords(pin: Pin | undefined): string {
  return pin ? `${Math.round(pin.x)}, ${Math.round(pin.y)}` : "—";
}
