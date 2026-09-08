import { ArrowUpRight, Highlighter, MousePointer2, Pen, StickyNote, Trash2 } from "lucide-react";

import { ANNOTATION_COLORS, type AnnotationKind } from "../core/annotate";
import { useDocumentStore } from "../store/useDocumentStore";
import { IconButton, Tooltip } from "./ui";


const TOOLS: Array<{ kind: AnnotationKind; icon: React.ReactNode; label: string; key: string }> = [
  {
    kind: "note",
    icon: <StickyNote size={15} strokeWidth={1.75} />,
    label: "Note — click to place, drag to size",
    key: "N",
  },
  {
    kind: "arrow",
    icon: <ArrowUpRight size={15} strokeWidth={1.75} />,
    label: "Arrow — drag from anywhere to anywhere",
    key: "A",
  },
  {
    kind: "highlight",
    icon: <Highlighter size={15} strokeWidth={1.75} />,
    label: "Highlight — drag over the part under discussion",
    key: "H",
  },
  {
    kind: "stroke",
    icon: <Pen size={15} strokeWidth={1.75} />,
    label: "Draw — freehand ink",
    key: "D",
  },
];

export function AnnotationTools() {
  const tool = useDocumentStore((s) => s.annotationTool);
  const pen = useDocumentStore((s) => s.annotationPen);
  const setTool = useDocumentStore((s) => s.setAnnotationTool);
  const setPen = useDocumentStore((s) => s.setAnnotationPen);
  const selection = useDocumentStore((s) => s.annotationSelection);
  const removeAnnotations = useDocumentStore((s) => s.removeAnnotations);

  return (
    <div
      className="absolute top-3 left-3 flex flex-col items-center gap-0.5 rounded-xl p-1 opacity-70 transition-opacity hover:opacity-100"
      data-canvas-ui
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-2)",
      }}
    >
      <IconButton
        icon={<MousePointer2 size={15} strokeWidth={1.75} />}
        onClick={() => setTool(null)}
        active={tool === null}
        title="Select and move"
        shortcut="V"
      />

      <div className="my-0.5 h-px w-5" style={{ background: "var(--border)" }} />

      {TOOLS.map((entry) => (
        <IconButton
          key={entry.kind}
          icon={entry.icon}
          onClick={() => setTool(tool === entry.kind ? null : entry.kind)}
          active={tool === entry.kind}
          title={entry.label}
          shortcut={entry.key}
        />
      ))}

      <div className="my-0.5 h-px w-5" style={{ background: "var(--border)" }} />


      <div className="flex flex-col items-center gap-1 py-1">
        {ANNOTATION_COLORS.map((colour) => (
          <Tooltip
            key={colour.id}
            label={selection.size > 0 ? `Recolour — ${colour.label}` : colour.label}
            side="right"
          >
            <button
              type="button"
              onClick={() => setPen(colour.id)}
              aria-label={colour.label}
              aria-pressed={pen === colour.id}
              className="focus-ring h-4 w-4 cursor-pointer rounded-full transition-transform hover:scale-110"
              style={{
                background: colour.value,
                outline: pen === colour.id ? `2px solid var(--text-3)` : "none",
                outlineOffset: 2,
              }}
            />
          </Tooltip>
        ))}
      </div>

      <div className="my-0.5 h-px w-5" style={{ background: "var(--border)" }} />

      <IconButton
        icon={<Trash2 size={15} strokeWidth={1.75} />}
        onClick={() => removeAnnotations([...selection])}
        disabled={selection.size === 0}
        title={
          selection.size === 0
            ? "Select a mark to delete it"
            : `Delete ${selection.size === 1 ? "this mark" : `${selection.size} marks`}`
        }
        shortcut="Del"
      />
    </div>
  );
}
