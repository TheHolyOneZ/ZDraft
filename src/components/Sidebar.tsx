import { ArrowRight, CornerUpLeft, MapPin, PinOff, Trash2 } from "lucide-react";

import { isGraph, isPassthrough, isSequence, nodeText } from "../core/model/scene";
import { useDocumentStore } from "../store/useDocumentStore";
import { FileTree } from "./FileTree";
import { EmptyState, IconButton, Panel, SectionHeader } from "./ui";


export function Sidebar({ onNewDiagram }: { onNewDiagram(): void }) {
  return (
    <Panel className="h-full w-[240px] shrink-0" style={{ borderRight: "1px solid var(--border)" }}>
      <FileTree onNew={onNewDiagram} />
      <div className="h-px shrink-0" style={{ background: "var(--border)" }} />
      <Outline />
      <div className="h-px shrink-0" style={{ background: "var(--border)" }} />
      <Pins />
    </Panel>
  );
}

function Outline() {
  const scene = useDocumentStore((s) => s.scene);
  const selection = useDocumentStore((s) => s.selection);
  const hovered = useDocumentStore((s) => s.hovered);
  const select = useDocumentStore((s) => s.select);
  const setHovered = useDocumentStore((s) => s.setHovered);
  const pins = useDocumentStore((s) => s.layout.pins);


  const nodes =
    scene && isGraph(scene)
      ? scene.nodes.map((n) => ({ id: n.id, label: nodeText(n.body) || n.id }))
      : scene && isSequence(scene)
        ? scene.lifelines.map((l) => ({ id: l.id, label: l.label }))
        : [];

  const passthrough = scene && isPassthrough(scene) ? scene : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader count={nodes.length}>Outline</SectionHeader>

      {nodes.length === 0 ? (


        passthrough ? (
          <EmptyState
            title="Not modelled"
            body={`ZDraft shows ${passthrough.diagramType} diagrams as the engine draws them, so there is no outline to list.`}
          />
        ) : (
          <EmptyState title="Nothing to outline yet" body="Nodes you declare will be listed here." />
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {nodes.map((node) => {
            const active = selection.has(node.id);
            return (
              <button
                key={node.id}
                type="button"
                onClick={(e) => select([node.id], e.shiftKey || e.ctrlKey || e.metaKey)}
                onPointerEnter={() => setHovered(node.id)}
                onPointerLeave={() => setHovered(null)}
                className="focus-ring flex w-full cursor-pointer items-center gap-2 px-3 py-[3px] text-left text-[12px] transition-colors"
                style={{
                  background: active
                    ? "var(--row-selected)"
                    : hovered === node.id
                      ? "var(--row-hover)"
                      : "transparent",
                  color: active ? "var(--text)" : "var(--text-2)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
                  style={{ background: active ? "var(--accent)" : "var(--text-3)" }}
                />
                <span className="truncate">{node.label}</span>
                {pins?.[node.id] && (
                  <MapPin size={11} strokeWidth={2} style={{ color: "var(--pin)" }} className="ml-auto shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pins() {
  const layout = useDocumentStore((s) => s.layout);
  const orphans = useDocumentStore((s) => s.orphans);
  const selection = useDocumentStore((s) => s.selection);
  const select = useDocumentStore((s) => s.select);
  const releasePins = useDocumentStore((s) => s.releasePins);
  const releaseAllPins = useDocumentStore((s) => s.releaseAllPins);
  const migrateOrphan = useDocumentStore((s) => s.migrateOrphan);
  const dropOrphans = useDocumentStore((s) => s.dropOrphans);
  const scene = useDocumentStore((s) => s.scene);

  const passthrough = scene && isPassthrough(scene) ? scene : null;
  const entries = Object.entries(layout.pins ?? {});
  const orphanIds = new Set(orphans.map((o) => o.id));
  const live = entries.filter(([id]) => !orphanIds.has(id));

  return (
    <div className="flex max-h-[45%] min-h-[120px] flex-col" data-tour="pins">
      <SectionHeader
        count={entries.length}
        actions={
          entries.length > 0 ? (
            <IconButton
              icon={<PinOff size={13} strokeWidth={1.75} />}
              onClick={releaseAllPins}
              title="Release all pins"
              size={22}
            />
          ) : null
        }
      >
        Pins
      </SectionHeader>

      {entries.length === 0 ? (


        passthrough ? (
          <EmptyState
            title="Nothing to pin"
            body="This diagram has no positions to override. Every other engine ZDraft supports does."
          />
        ) : (
          <EmptyState
            title="Nothing pinned"
            body="Drag a node the layout got wrong. The move is saved beside your diagram, and the source file stays untouched."
          />
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {live.map(([id, pin]) => (
            <div
              key={id}
              className="group flex items-center gap-2 px-3 py-[3px] text-[12px] transition-colors"
              style={{
                background: selection.has(id) ? "var(--row-selected)" : "transparent",
                color: "var(--text-2)",
              }}
            >
              <MapPin size={11} strokeWidth={2} style={{ color: "var(--pin)" }} className="shrink-0" />
              <button
                type="button"
                onClick={() => select([id], false)}
                className="focus-ring min-w-0 flex-1 cursor-pointer truncate text-left"
              >
                {id}
              </button>
              <span className="tnum shrink-0 text-[10px]" style={{ color: "var(--text-3)" }}>
                {Math.round(pin.x)},{Math.round(pin.y)}
              </span>
              <IconButton
                icon={<CornerUpLeft size={12} strokeWidth={1.75} />}
                onClick={() => releasePins([id])}
                title="Release pin — back to auto-layout"
                size={20}
              />
            </div>
          ))}

          {orphans.length > 0 && (
            <div className="mt-2">
              <SectionHeader count={orphans.length}>Orphaned</SectionHeader>
              <p className="px-3 pb-1.5 text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
                These pins point at nodes that are no longer in the diagram.
              </p>
              {orphans.map((orphan) => (
                <div key={orphan.id} className="px-3 py-1">
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-2)" }}>
                    <MapPin size={11} strokeWidth={2} style={{ color: "var(--warn)" }} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{orphan.id}</span>
                    <IconButton
                      icon={<Trash2 size={12} strokeWidth={1.75} />}
                      onClick={() => dropOrphans([orphan.id])}
                      title="Delete this pin"
                      size={20}
                    />
                  </div>
                  {orphan.migrateTo && (
                    <button
                      type="button"
                      onClick={() => migrateOrphan(orphan.id, orphan.migrateTo!)}
                      className="focus-ring mt-1 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition-colors"
                      style={{ background: "var(--pin-soft)", color: "var(--text-2)" }}
                    >
                      <span>Looks renamed —</span>
                      <span className="font-medium" style={{ color: "var(--text)" }}>
                        move to {orphan.migrateTo}
                      </span>
                      <ArrowRight size={11} strokeWidth={2} className="ml-auto shrink-0" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
