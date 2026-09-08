import { GitCompare, X } from "lucide-react";
import { useMemo } from "react";

import { diffScenes, isLayoutOnly, type DiffNode, type NodeChange } from "../core/diff";
import { DIFF_MOVED } from "./scene/GraphLayers";
import { useDocumentStore } from "../store/useDocumentStore";
import { IconButton, Tooltip } from "./ui";


export function DiffBar() {
  const diffMode = useDocumentStore((s) => s.diffMode);
  const headScene = useDocumentStore((s) => s.headScene);
  const headPinned = useDocumentStore((s) => s.headPinned);
  const scene = useDocumentStore((s) => s.scene);
  const pins = useDocumentStore((s) => s.layout.pins);
  const git = useDocumentStore((s) => s.git);
  const setDiffMode = useDocumentStore((s) => s.setDiffMode);
  const select = useDocumentStore((s) => s.select);

  const diff = useMemo(
    () =>
      diffScenes(headScene, scene, {
        pinnedBefore: headPinned,
        pinnedAfter: new Set(Object.keys(pins ?? {})),
      }),
    [headScene, scene, headPinned, pins],
  );


  const ambiguous = useMemo(() => {
    const seen = new Map<string, number>();
    for (const node of diff.nodes) {
      const key = node.label || node.id;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen].filter(([, n]) => n > 1).map(([key]) => key));
  }, [diff]);

  if (!diffMode) return null;

  const close = (
    <IconButton
      icon={<X size={13} strokeWidth={1.75} />}
      onClick={() => void setDiffMode(false)}
      title="Stop comparing"
      size={22}
    />
  );

  if (!headScene) {
    return (
      <Bar>
        <Label />
        <span style={{ color: "var(--text-3)" }}>
          {!git?.repository
            ? "This folder is not a git repository, so there is nothing to compare against."
            : "This file has not been committed yet, so there is nothing to compare against."}
        </span>
        <span className="ml-auto">{close}</span>
      </Bar>
    );
  }

  return (
    <Bar>
      <Tooltip label="Re-read the last commit — after a commit, a pull or a branch switch">
        <button
          type="button"
          onClick={() => void setDiffMode(true)}
          className="focus-ring shrink-0 cursor-pointer rounded-md"
        >
          <Label head={git?.head} />
        </button>
      </Tooltip>

      {diff.identical ? (
        <span style={{ color: "var(--text-3)" }}>
          Identical to {git?.head ? `${git.head}` : "the last commit"} — source and layout both.
        </span>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {[...diff.nodes].sort(bySignificance).map((node) => (
            <Chip
              key={node.id}
              change={node.change}
              onClick={() => node.rect && select([node.id], false)}
              clickable={Boolean(node.rect)}


              id={ambiguous.has(node.label || node.id) ? node.id : undefined}
            >
              {node.label || node.id}
            </Chip>
          ))}
          {diff.edges.map((edge) => (
            <Chip key={edge.id} change={edge.change} clickable={false}>
              {edge.id.replace("->", " → ")}
            </Chip>
          ))}
        </div>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-2">
        {!diff.identical && (
          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
            {diff.summary}
          </span>
        )}
        {close}
      </span>
    </Bar>
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2.5 px-3 text-[12px]"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}


function Label({ head }: { head?: string | null }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5" style={{ color: "var(--accent)" }}>
      <GitCompare size={13} strokeWidth={1.75} />
      <span className="text-[10px] font-semibold tracking-[0.08em] uppercase">vs</span>
      <span className="font-mono text-[11px]">{head || "HEAD"}</span>
    </span>
  );
}


const RANK: Record<NodeChange, number> = {
  added: 0,
  removed: 1,
  relabelled: 2,
  reshaped: 3,
  moved: 4,
};

function bySignificance(a: DiffNode, b: DiffNode): number {
  return RANK[a.change] - RANK[b.change] || (a.label ?? a.id).localeCompare(b.label ?? b.id);
}

const COLOURS: Record<NodeChange, string> = {
  added: "#4ade80",
  removed: "#f87171",
  moved: DIFF_MOVED,
  relabelled: "#c084fc",
  reshaped: "#c084fc",
};

const VERBS: Record<NodeChange, string> = {
  added: "added",
  removed: "removed",
  moved: "moved",
  relabelled: "renamed",
  reshaped: "reshaped",
};

function Chip({
  change,
  children,
  onClick,
  clickable,
  id,
}: {
  change: NodeChange;
  children: React.ReactNode;
  onClick?(): void;
  clickable: boolean;

  id?: string;
}) {
  const colour = COLOURS[change];

  const body = (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px]"
      style={{ background: "var(--control)", border: `1px solid ${colour}55` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colour }} />
      <span className="max-w-[160px] truncate" style={{ color: "var(--text)" }}>
        {children}
      </span>
      {id && (
        <span className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
          {id}
        </span>
      )}
      <span style={{ color: "var(--text-3)" }}>{VERBS[change]}</span>
    </span>
  );

  const tip = isLayoutOnly(change)
    ? "In the layout sidecar — your source file is unchanged here"
    : "In your source file";

  if (!clickable) return <Tooltip label={tip}>{body}</Tooltip>;

  return (
    <Tooltip label={tip}>
      <button type="button" onClick={onClick} className="focus-ring cursor-pointer rounded-md">
        {body}
      </button>
    </Tooltip>
  );
}
