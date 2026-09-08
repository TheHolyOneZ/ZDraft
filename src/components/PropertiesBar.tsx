import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Check,
  FileCode2,
  FileCog,
  MapPin,
  MoveHorizontal,
  MoveVertical,
  PinOff,
  RotateCcw,
  Spline,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { align, distribute, placed, type AlignEdge } from "../core/align";

import { rectCenter, type Point } from "../core/model/geometry";
import {
  isGraph,
  isPassthrough,
  isSequence,
  nodesIn,
  nodeText,
  type GraphNode,
  type NodeShape,
} from "../core/model/scene";
import { adapterFor, useDocumentStore } from "../store/useDocumentStore";
import { IconButton, Select, TextInput, Tooltip } from "./ui";


export function PropertiesBar() {
  const scene = useDocumentStore((s) => s.scene);
  const selection = useDocumentStore((s) => s.selection);
  const selectedEdge = useDocumentStore((s) => s.selectedEdge);
  const pins = useDocumentStore((s) => s.layout.pins);
  const edgeHints = useDocumentStore((s) => s.layout.edges);
  const releasePins = useDocumentStore((s) => s.releasePins);
  const setWaypoints = useDocumentStore((s) => s.setWaypoints);
  const setLabelOffset = useDocumentStore((s) => s.setLabelOffset);
  const name = useDocumentStore((s) => s.name);
  const annotations = useDocumentStore((s) => s.layout.annotations);
  const annotationSelection = useDocumentStore((s) => s.annotationSelection);
  const removeAnnotations = useDocumentStore((s) => s.removeAnnotations);
  const updateAnnotation = useDocumentStore((s) => s.updateAnnotation);


  const selectedMarks = annotations
    ? [...annotationSelection].filter((id) => annotations[id])
    : [];

  if (selectedMarks.length > 0 && annotations) {
    const ids = selectedMarks;
    const only = ids.length === 1 ? annotations[ids[0]!] : null;

    return (
      <Bar>
        <Group icon="layout" label={only ? only.kind : `${ids.length} marks`}>
          {only?.kind === "note" && only.text ? (
            <span className="max-w-[320px] truncate" style={{ color: "var(--text)" }}>
              “{only.text}”
            </span>
          ) : (
            <span style={{ color: "var(--text-3)" }}>
              Annotations live beside your diagram, never in it.
            </span>
          )}
        </Group>

        {only?.anchor && (
          <>
            <div className="h-4 w-px" style={{ background: "var(--border)" }} />
            <Group icon="layout" label="about">
              <span className="font-medium" style={{ color: "var(--text)" }}>
                {only.anchor}
              </span>
              <IconButton
                icon={<PinOff size={13} strokeWidth={1.75} />}
                onClick={() => updateAnnotation(ids[0]!, { anchor: null })}
                title="Stop pointing at it — the note stays where it is"
                size={22}
              />
            </Group>
          </>
        )}

        <div className="h-4 w-px" style={{ background: "var(--border)" }} />

        <IconButton
          icon={<X size={13} strokeWidth={1.75} />}
          onClick={() => removeAnnotations(ids)}
          title={ids.length === 1 ? "Delete this mark" : `Delete ${ids.length} marks`}
          shortcut="Del"
          size={22}
        />

        <span className="ml-auto truncate text-[11px]" style={{ color: "var(--text-3)" }}>
          {name}.zlayout.toml
        </span>
      </Bar>
    );
  }

  if (scene && isSequence(scene)) return <SequenceProperties />;


  if (scene && isPassthrough(scene)) {
    return (
      <Bar>
        <Group icon="source" label={scene.diagramType}>
          <span style={{ color: "var(--text-3)" }}>{scene.reason}</span>
        </Group>
        <span className="ml-auto truncate text-[11px]" style={{ color: "var(--text-3)" }}>
          {name}
        </span>
      </Bar>
    );
  }

  const graph = scene && isGraph(scene) ? scene : null;
  const clusters = graph ? graph.clusters.filter((c) => selection.has(c.id)) : [];


  const nodes = graph ? nodesIn(graph, selection) : [];

  if (graph && selectedEdge && nodes.length === 0) {
    const edge = graph.edges.find((e) => e.id === selectedEdge);
    if (edge) {
      const hint = edgeHints?.[edge.id];
      const bends = hint?.waypoints?.length ?? 0;
      const nudged = Boolean(hint?.label_offset);

      return (
        <Bar>
          <Group icon="source" label="edge">
            <span className="font-medium" style={{ color: "var(--text)" }}>
              {edge.from} → {edge.to}
            </span>
            {edge.label && (
              <span className="max-w-[220px] truncate" style={{ color: "var(--text-3)" }}>
                “{edge.label.text}”
              </span>
            )}
          </Group>

          <div className="h-4 w-px" style={{ background: "var(--border)" }} />

          <Group icon="layout" label="route">
            {bends > 0 ? (
              <>
                <Field label="bends" value={bends} />
                <IconButton
                  icon={<Spline size={13} strokeWidth={1.75} />}
                  onClick={() => setWaypoints(edge.id, [])}
                  title="Drop the bends — back to the engine's own route"
                  size={22}
                />
              </>
            ) : (
              <span style={{ color: "var(--text-3)" }}>auto</span>
            )}
            {nudged && (
              <IconButton
                icon={<PinOff size={13} strokeWidth={1.75} />}
                onClick={() => setLabelOffset(edge.id, null)}
                title="Put the label back where the engine centred it"
                size={22}
              />
            )}
          </Group>

          <span className="ml-auto truncate text-[11px]" style={{ color: "var(--text-3)" }}>
            {bends > 0 || nudged ? `${name}.zlayout.toml` : name}
          </span>
        </Bar>
      );
    }
  }

  if (nodes.length === 0) {
    return (
      <Bar>
        <span style={{ color: "var(--text-3)" }}>
          Select a node to inspect it. Drag one to override where auto-layout put it.
        </span>
      </Bar>
    );
  }

  if (clusters.length > 0) {
    const pinnedCount = nodes.filter((n) => pins?.[n.id]).length;
    const only = clusters.length === 1 ? clusters[0]! : null;

    return (
      <Bar>
        <Group icon="source" label={clusters.length === 1 ? "subgraph" : "subgraphs"}>
          <span className="font-medium" style={{ color: "var(--text)" }}>
            {only ? (only.label ?? only.id) : `${clusters.length} selected`}
          </span>
          <Field label="holds" value={`${nodes.length} node${nodes.length === 1 ? "" : "s"}`} />
        </Group>

        <div className="h-4 w-px" style={{ background: "var(--border)" }} />

        <Group icon="layout" label="position">


          <span className="tnum" style={{ color: "var(--text-3)" }}>
            {pinnedCount} of {nodes.length} pinned
          </span>
          {pinnedCount > 0 && (
            <IconButton
              icon={<PinOff size={13} strokeWidth={1.75} />}
              onClick={() => releasePins(nodes.map((n) => n.id))}
              title="Release every pin inside — back to auto-layout"
              size={22}
            />
          )}
        </Group>

        <span className="ml-auto text-[11px]" style={{ color: "var(--text-3)" }}>
          Dragging the box moves everything in it
        </span>
      </Bar>
    );
  }

  if (nodes.length > 1) {
    const pinnedCount = nodes.filter((n) => pins?.[n.id]).length;
    return (
      <Bar>
        <Group icon="layout" label={`${nodes.length} selected`}>
          <span className="tnum" style={{ color: "var(--text-3)" }}>
            {pinnedCount} pinned
          </span>
          {pinnedCount > 0 && (
            <IconButton
              icon={<PinOff size={13} strokeWidth={1.75} />}
              onClick={() => releasePins(nodes.map((n) => n.id))}
              title="Release these pins"
              size={22}
            />
          )}
        </Group>

        <div className="h-4 w-px" style={{ background: "var(--border)" }} />

        <AlignTools nodes={nodes} />

        <span className="ml-auto text-[11px]" style={{ color: "var(--text-3)" }}>
          Arrow keys nudge · Shift+arrows ×10 · Alt+drag ignores the grid
        </span>
      </Bar>
    );
  }

  const node = nodes[0]!;
  const center = rectCenter(node.rect);
  const pinned = Boolean(pins?.[node.id]);

  return (
    <Bar>
      <NodeIdentity node={node} />

      <div className="h-4 w-px" style={{ background: "var(--border)" }} />

      <Group icon="layout" label="position">
        <Field label="x" value={Math.round(center.x)} />
        <Field label="y" value={Math.round(center.y)} />

        {pinned ? (
          <>
            <span
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{ background: "var(--pin-soft)", color: "var(--pin)" }}
            >
              <MapPin size={11} strokeWidth={2} />
              pinned
            </span>
            <IconButton
              icon={<PinOff size={13} strokeWidth={1.75} />}
              onClick={() => releasePins([node.id])}
              title="Release pin — back to auto-layout"
              shortcut="P"
              size={22}
            />
          </>
        ) : (
          <span style={{ color: "var(--text-3)" }}>auto</span>
        )}
      </Group>

      <span className="ml-auto truncate text-[11px]" style={{ color: "var(--text-3)" }}>
        {pinned ? `${name}.zlayout.toml` : name}
      </span>
    </Bar>
  );
}


function NodeIdentity({ node }: { node: GraphNode }) {
  const engine = useDocumentStore((s) => s.engine);
  const editNode = useDocumentStore((s) => s.editNode);
  const editor = adapterFor(engine).edit ?? null;

  const label = nodeText(node.body);
  const [editing, setEditing] = useState<"id" | "label" | null>(null);
  const [draft, setDraft] = useState("");


  useEffect(() => setEditing(null), [node.id]);


  const renameRequest = useDocumentStore((s) => s.renameRequest);
  const requestRename = useDocumentStore((s) => s.requestRename);
  useEffect(() => {
    if (renameRequest !== node.id) return;
    setDraft(node.id);
    setEditing("id");
    requestRename(null);
  }, [renameRequest, node.id, requestRename]);

  const begin = (what: "id" | "label") => {
    setDraft(what === "id" ? node.id : label);
    setEditing(what);
  };

  const commit = () => {
    if (!editing) return;
    const value = draft.trim();

    if (editing === "id") {
      if (value !== node.id && !editor?.idProblem(value)) {
        editNode(node.id, { kind: "rename", to: value });
      }
    } else if (value !== label) {
      editNode(node.id, { kind: "label", text: draft });
    }
    setEditing(null);
  };

  const problem = editing === "id" ? (editor?.idProblem(draft) ?? null) : null;

  if (editing) {
    return (
      <Group icon="source" label={editing === "id" ? "rename" : "label"}>
        <span className="w-[220px]">
          <TextInput
            value={draft}
            onChange={setDraft}
            autoFocus
            invalid={problem}
            onSubmit={commit}
          />
        </span>
        <IconButton
          icon={<Check size={13} strokeWidth={2} />}
          onClick={commit}
          disabled={Boolean(problem)}
          title="Apply — this writes your source file"
          size={22}
        />
        <IconButton
          icon={<X size={13} strokeWidth={2} />}
          onClick={() => setEditing(null)}
          title="Cancel"
          size={22}
        />
      </Group>
    );
  }

  return (
    <Group icon="source" label="node">
      <EditableText
        value={node.id}
        editable={Boolean(editor)}
        onEdit={() => begin("id")}
        title={editor ? "Rename — changes every reference in your source" : undefined}
        strong
      />
      {label !== node.id && (
        <EditableText
          value={`“${label}”`}
          editable={Boolean(editor)}
          onEdit={() => begin("label")}
          title={editor ? "Edit the label — this writes your source file" : undefined}
        />
      )}

      {editor && editor.shapes.length > 0 ? (
        <Select
          value={editor.shapes.includes(node.shape) ? node.shape : editor.shapes[0]!}
          options={editor.shapes.map((shape) => ({ value: shape, label: shape }))}
          onChange={(shape) => editNode(node.id, { kind: "shape", shape: shape as NodeShape })}
          menuWidth={180}
        />
      ) : (
        <Field label="shape" value={node.shape} />
      )}
    </Group>
  );
}


function EditableText({
  value,
  editable,
  onEdit,
  title,
  strong,
}: {
  value: string;
  editable: boolean;
  onEdit(): void;
  title?: string;
  strong?: boolean;
}) {
  const text = (
    <span
      className={`max-w-[220px] truncate${strong ? " font-medium" : ""}`}
      style={{ color: strong ? "var(--text)" : "var(--text-3)" }}
    >
      {value}
    </span>
  );

  if (!editable) return text;

  return (
    <Tooltip label={title ?? ""}>
      <button
        type="button"
        onClick={onEdit}
        onDoubleClick={onEdit}
        className="focus-ring -mx-1 flex cursor-text items-center rounded px-1 transition-colors"
        onPointerEnter={(e) => (e.currentTarget.style.background = "var(--row-hover)")}
        onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {text}
      </button>
    </Tooltip>
  );
}


function AlignTools({ nodes }: { nodes: GraphNode[] }) {
  const pinAt = useDocumentStore((s) => s.pinAt);
  const items = useMemo(() => placed(nodes), [nodes]);

  const apply = (positions: Map<string, Point>) => {


    if (positions.size > 0) pinAt(positions, 0);
  };

  return (
    <div className="flex items-center gap-2">
      <Tooltip label="Aligning writes pins — your source file is untouched">
        <span className="flex items-center gap-1.5" style={{ color: "var(--pin)" }}>
          <FileCog size={13} strokeWidth={1.75} />
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase">align</span>
        </span>
      </Tooltip>

      <span className="flex items-center gap-0.5">
        {ALIGNMENTS.map(({ edge, icon, title }) => (
          <IconButton
            key={edge}
            icon={icon}
            onClick={() => apply(align(items, edge))}
            title={title}
            size={22}
          />
        ))}
      </span>

      <div className="h-4 w-px" style={{ background: "var(--border)" }} />

      <span className="flex items-center gap-0.5">
        <IconButton
          icon={<AlignHorizontalSpaceAround size={13} strokeWidth={1.75} />}
          onClick={() => apply(distribute(items, "horizontal"))}
          disabled={nodes.length < 3}
          title={
            nodes.length < 3
              ? "Evening out gaps needs three nodes"
              : "Even the horizontal gaps"
          }
          size={22}
        />
        <IconButton
          icon={<AlignVerticalSpaceAround size={13} strokeWidth={1.75} />}
          onClick={() => apply(distribute(items, "vertical"))}
          disabled={nodes.length < 3}
          title={nodes.length < 3 ? "Evening out gaps needs three nodes" : "Even the vertical gaps"}
          size={22}
        />
      </span>
    </div>
  );
}


const ALIGNMENTS: Array<{ edge: AlignEdge; icon: React.ReactNode; title: string }> = [
  { edge: "left", icon: <AlignStartVertical size={13} strokeWidth={1.75} />, title: "Align left edges" },
  {
    edge: "center-x",
    icon: <AlignCenterVertical size={13} strokeWidth={1.75} />,
    title: "Align centres horizontally",
  },
  { edge: "right", icon: <AlignEndVertical size={13} strokeWidth={1.75} />, title: "Align right edges" },
  { edge: "top", icon: <AlignStartHorizontal size={13} strokeWidth={1.75} />, title: "Align tops" },
  {
    edge: "middle-y",
    icon: <AlignCenterHorizontal size={13} strokeWidth={1.75} />,
    title: "Align middles vertically",
  },
  { edge: "bottom", icon: <AlignEndHorizontal size={13} strokeWidth={1.75} />, title: "Align bottoms" },
];

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2.5 px-3 text-[12px]"
      style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}


function Group({
  icon,
  label,
  children,
}: {
  icon: "source" | "layout";
  label: string;
  children: React.ReactNode;
}) {
  const isSource = icon === "source";

  return (
    <div className="flex items-center gap-2">
      <Tooltip
        label={
          isSource
            ? "Edits here change your diagram source file"
            : "Edits here change the layout sidecar — your source file is untouched"
        }
      >
        <span className="flex items-center gap-1.5" style={{ color: isSource ? "var(--text-3)" : "var(--pin)" }}>
          {isSource ? <FileCode2 size={13} strokeWidth={1.75} /> : <FileCog size={13} strokeWidth={1.75} />}
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase">{label}</span>
        </span>
      </Tooltip>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
        {label}
      </span>
      <span className="tnum font-medium" style={{ color: "var(--text-2)" }}>
        {value}
      </span>
    </span>
  );
}


function SequenceProperties() {
  const scene = useDocumentStore((s) => s.scene);
  const selection = useDocumentStore((s) => s.selection);
  const selectedEdge = useDocumentStore((s) => s.selectedEdge);
  const sequence = useDocumentStore((s) => s.layout.sequence);
  const setSequenceGap = useDocumentStore((s) => s.setSequenceGap);
  const setLifelineOrder = useDocumentStore((s) => s.setLifelineOrder);
  const name = useDocumentStore((s) => s.name);

  if (!scene || !isSequence(scene)) return null;

  const lifeline = scene.lifelines.find((l) => selection.has(l.id));
  const messageIndex = scene.messages.findIndex((m) => m.id === selectedEdge);
  const message = messageIndex >= 0 ? scene.messages[messageIndex] : undefined;
  const previous = messageIndex > 0 ? scene.messages[messageIndex - 1] : undefined;

  const ordered = Boolean(sequence?.lifeline_order?.length);

  if (!lifeline && !message) {
    return (
      <Bar>
        <span style={{ color: "var(--text-3)" }}>
          Drag a lifeline header to move its column. Drag the grip between two headers, or a message,
          to add space.
        </span>
        {ordered && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              custom column order
            </span>
            <IconButton
              icon={<RotateCcw size={13} strokeWidth={1.75} />}
              onClick={() => setLifelineOrder([])}
              title="Back to the order the source declares"
              size={22}
            />
          </span>
        )}
      </Bar>
    );
  }

  if (lifeline) {
    const index = scene.lifelines.findIndex((l) => l.id === lifeline.id);
    const gap = sequence?.lifeline_gap?.[lifeline.id] ?? 0;

    return (
      <Bar>
        <Group icon="source" label="lifeline">
          <span className="font-medium" style={{ color: "var(--text)" }}>
            {lifeline.label}
          </span>
          {lifeline.label !== lifeline.id && (
            <span style={{ color: "var(--text-3)" }}>{lifeline.id}</span>
          )}
        </Group>

        <div className="h-4 w-px" style={{ background: "var(--border)" }} />

        <Group icon="layout" label="column">
          <Field label="position" value={`${index + 1} of ${scene.lifelines.length}`} />

          {index > 0 && (
            <Stepper
              icon={<MoveHorizontal size={12} strokeWidth={1.75} />}
              value={gap}
              onChange={(next) => setSequenceGap("lifeline", lifeline.id, next)}
            />
          )}
        </Group>

        <span className="ml-auto truncate text-[11px]" style={{ color: "var(--text-3)" }}>
          {ordered || gap ? `${name}.zlayout.toml` : name}
        </span>
      </Bar>
    );
  }

  const gap = previous ? (sequence?.message_gap?.[previous.id] ?? 0) : 0;

  return (
    <Bar>
      <Group icon="source" label="message">
        <span className="max-w-[280px] truncate font-medium" style={{ color: "var(--text)" }}>
          {message!.label || message!.id}
        </span>
        <span style={{ color: "var(--text-3)" }}>
          {message!.from} → {message!.to}
        </span>
      </Group>

      <div className="h-4 w-px" style={{ background: "var(--border)" }} />

      <Group icon="layout" label="spacing">
        {previous ? (
          <Stepper
            icon={<MoveVertical size={12} strokeWidth={1.75} />}
            value={gap}
            onChange={(next) => setSequenceGap("message", previous.id, next)}
          />
        ) : (
          <span style={{ color: "var(--text-3)" }}>first message — nothing above it</span>
        )}
      </Group>

      <span className="ml-auto truncate text-[11px]" style={{ color: "var(--text-3)" }}>
        {gap ? `${name}.zlayout.toml` : name}
      </span>
    </Bar>
  );
}


function Stepper({
  icon,
  value,
  onChange,
  step = 8,
}: {
  icon: React.ReactNode;
  value: number;
  onChange(next: number): void;
  step?: number;
}) {
  return (
    <span
      className="flex items-center gap-0.5 rounded-md px-1"
      style={{ background: "var(--control)", border: "1px solid var(--border)" }}
    >
      <span className="pr-0.5" style={{ color: "var(--text-3)" }}>
        {icon}
      </span>
      <IconButton
        icon={<span className="text-[13px] leading-none">−</span>}
        onClick={() => onChange(Math.max(0, value - step))}
        disabled={value === 0}
        title="Less space"
        size={20}
      />
      <span className="tnum w-9 text-center text-[11px] font-medium" style={{ color: "var(--text-2)" }}>
        {value} px
      </span>
      <IconButton
        icon={<span className="text-[13px] leading-none">+</span>}
        onClick={() => onChange(value + step)}
        title="More space"
        size={20}
      />
    </span>
  );
}
