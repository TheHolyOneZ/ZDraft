import { Modal } from "./ui";


interface Shortcut {


  keys: string[];
  what: string;

  note?: string;
}

const GROUPS: Array<{ title: string; items: Shortcut[] }> = [
  {
    title: "Files",
    items: [
      { keys: ["Ctrl", "N"], what: "New diagram" },
      {
        keys: ["Ctrl", "⇧", "N"],
        what: "New from a template",
        note: "Worked examples — C4, sequences, schemas, deployments.",
      },
      {
        keys: ["Ctrl", "⇧", "O"],
        what: "Import from draw.io or Excalidraw",
        note: "Every box arrives pinned where its author put it.",
      },
      { keys: ["Ctrl", "S"], what: "Save the source" },
      { keys: ["Ctrl", "E"], what: "Export" },
      { keys: ["Ctrl", "K"], what: "Command palette" },
      { keys: ["Ctrl", ","], what: "Settings" },
      { keys: ["Ctrl", "/"], what: "This list" },
      {
        keys: ["Ctrl", "⇧", "G"],
        what: "Compare with the last commit",
        note: "Added, removed, renamed and moved, over the diagram itself.",
      },
    ],
  },
  {
    title: "Editing",
    items: [
      {
        keys: ["Ctrl", "Z"],
        what: "Undo",
        note: "One timeline over text and layout, so a drag undoes as readily as a keystroke.",
      },
      {
        keys: ["Ctrl", "Y"],
        what: "Redo",
        note: "Ctrl ⇧ Z too, where the system does not claim it first — on Linux it usually does.",
      },
      {
        keys: ["Ctrl", "G"],
        what: "Group the selection into a container",
        note: "Also a source edit — the nodes stay where they are declared.",
      },
      {
        keys: ["F2"],
        what: "Rename the selected node",
        note: "A source edit in Graphviz, Mermaid and D2 — every reference changes, and the pin follows.",
      },
      {
        keys: ["Ctrl", "⏎"],
        what: "Re-render now",
        note: "For when re-render-as-you-type is off.",
      },
    ],
  },
  {
    title: "The canvas",
    items: [
      { keys: ["Drag"], what: "Move a node, a subgraph, an edge bend or a label" },
      { keys: ["Alt", "drag"], what: "Move without snapping to the grid" },
      { keys: ["Arrows"], what: "Nudge by one, ⇧ for ten", note: "Never snapped — that is the point." },
      { keys: ["P"], what: "Pin or release the selection" },
      { keys: ["Double-click"], what: "Drop a bend, or put a label back" },
      { keys: ["⇧", "click"], what: "Add to the selection" },
      { keys: ["Drag on empty space"], what: "Marquee select" },
      { keys: ["Space", "drag"], what: "Pan", note: "Middle-drag does the same." },
      { keys: ["Ctrl", "scroll"], what: "Zoom to the pointer" },
      { keys: ["Ctrl", "+ / −"], what: "Zoom in and out" },
      { keys: ["Ctrl", "0"], what: "Back to 100%" },
      { keys: ["Ctrl", "⇧", "F"], what: "Fit the diagram" },
      { keys: ["Esc"], what: "Clear the selection" },
    ],
  },
  {
    title: "Marking up",
    items: [
      { keys: ["V"], what: "Back to the pointer", note: "Escape does it too." },
      { keys: ["N"], what: "Note", note: "Click a box to write about it; the line follows the box." },
      { keys: ["A"], what: "Arrow" },
      { keys: ["H"], what: "Highlight" },
      { keys: ["D"], what: "Draw freehand" },
      { keys: ["Del"], what: "Delete the selected marks" },
      {
        keys: ["Double-click"],
        what: "Edit a note",
        note: "Marks live in the sidecar — your source file never sees them.",
      },
    ],
  },
  {
    title: "Presenting",
    items: [
      { keys: ["F5"], what: "Present", note: "The diagram, a step at a time, and nothing else." },
      { keys: ["Space"], what: "Next step", note: "→, Page Down and a click do the same." },
      { keys: ["⇧", "click"], what: "Back a step", note: "← and Page Up too; so does a right-click." },
      { keys: ["F"], what: "Fullscreen" },
      { keys: ["Esc"], what: "Stop presenting" },
    ],
  },
  {
    title: "Layout",
    items: [
      { keys: ["Ctrl", "\\"], what: "Cycle the split: side, stacked, canvas only" },
      { keys: ["Ctrl", "B"], what: "Show or hide the sidebar" },
      { keys: ["Ctrl", "⇧", "D"], what: "Zen mode", note: "Everything but the canvas gets out of the way." },
      { keys: ["/"], what: "Jump to a node by name" },
    ],
  },
];

export function Shortcuts({ open, onClose }: { open: boolean; onClose(): void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard"
      description="Ctrl is ⌘ on a Mac. Nothing here needs a mouse."
      width={720}
    >
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 sm:[grid-template-areas:'files_canvas''editing_canvas''marking_canvas''presenting_canvas''layout_canvas']">
        {GROUPS.map((group) => (
          <section
            key={group.title}
            className="mb-3"
            style={{ gridArea: group.title.toLowerCase().replace(/^the /, "").split(" ")[0] }}
          >
            <h3
              className="mb-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--text-3)" }}
            >
              {group.title}
            </h3>

            <dl className="flex flex-col gap-1.5">
              {group.items.map((item) => (
                <div key={item.keys.join("+") + item.what} className="flex items-baseline gap-3">
                  <dt className="shrink-0">
                    <Keys parts={item.keys} />
                  </dt>
                  <dd className="min-w-0 flex-1">
                    <div className="text-[12px]" style={{ color: "var(--text)" }}>
                      {item.what}
                    </div>
                    {item.note && (
                      <div className="text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
                        {item.note}
                      </div>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}


function Keys({ parts }: { parts: readonly string[] }) {
  return (
    <span className="flex items-center gap-1">
      {parts.map((part, i) => (
        <kbd
          key={`${part}-${i}`}
          className="tnum inline-flex min-w-[22px] items-center justify-center rounded-[5px] px-1.5 py-0.5 font-mono text-[11px]"
          style={{
            background: "var(--control)",
            border: "1px solid var(--border)",
            borderBottomWidth: 2,
            color: "var(--text-2)",
          }}
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
