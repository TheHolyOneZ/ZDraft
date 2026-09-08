import { Hash, Tag } from "lucide-react";
import { useEffect, useState } from "react";

import { useDocumentStore } from "../store/useDocumentStore";
import { toast } from "../store/useToastStore";
import { Button, Modal, TextInput, Tooltip } from "./ui";


export function BlockBar() {
  const blocks = useDocumentStore((s) => s.blocks);
  const active = useDocumentStore((s) => s.activeBlock);
  const selectBlock = useDocumentStore((s) => s.selectBlock);
  const markBlock = useDocumentStore((s) => s.markBlock);
  const sidecar = useDocumentStore((s) => s.sidecar);

  const [naming, setNaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (naming) setDraft(suggest(naming));
  }, [naming]);

  if (blocks.length === 0) return null;

  const apply = () => {
    if (!naming) return;
    if (markBlock(naming, draft)) {
      toast.success("Marker written", `This block is now “${draft.trim()}” whatever order it sits in.`);
      setNaming(null);
    } else {
      toast.error("That name will not work", "It is already used by another block, or has characters a marker cannot hold.");
    }
  };

  return (
    <>
      <div
        className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto px-2"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="mr-1 shrink-0 text-[10px] font-semibold tracking-[0.08em] uppercase"
          style={{ color: "var(--text-3)" }}
        >
          {blocks.length} diagram{blocks.length === 1 ? "" : "s"}
        </span>

        {blocks.map((block) => {
          const current = block.id === active;
          const pinned = Object.keys(sidecar.blocks?.[block.id]?.pins ?? {}).length;

          return (
            <button
              key={block.id}
              type="button"
              onClick={() => selectBlock(block.id)}
              className="focus-ring flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[12px] transition-colors"
              style={{
                background: current ? "var(--row-selected)" : "transparent",
                color: current ? "var(--text)" : "var(--text-3)",
                border: `1px solid ${current ? "var(--accent-line)" : "transparent"}`,
              }}
            >
              {block.marked ? (
                <Tag size={11} strokeWidth={1.75} />
              ) : (
                <Hash size={11} strokeWidth={1.75} style={{ color: "var(--warn)" }} />
              )}
              <span className="max-w-[160px] truncate">{block.id}</span>
              <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                {block.engine}
              </span>
              {pinned > 0 && (
                <span
                  className="tnum rounded px-1 text-[10px] font-medium"
                  style={{ background: "var(--pin-soft)", color: "var(--pin)" }}
                >
                  {pinned}
                </span>
              )}
            </button>
          );
        })}

        <span className="flex-1" />

        {active && blocks.find((b) => b.id === active)?.marked === false && (
          <Tooltip label="Without a marker this block's layout is keyed by its position, so moving it loses the pins">
            <Button onClick={() => setNaming(active)}>
              <Tag size={13} strokeWidth={1.75} />
              Give it a name
            </Button>
          </Tooltip>
        )}
      </div>

      <Modal
        open={naming !== null}
        onClose={() => setNaming(null)}
        title="Name this block"
        description="ZDraft writes an HTML comment above the fence. Every markdown renderer ignores it, so the block still renders natively on GitHub — but the layout now follows the block instead of its position."
        width={460}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={() => setNaming(null)}>Cancel</Button>
            <Button variant="primary" onClick={apply} disabled={draft.trim() === ""}>
              <Tag size={13} strokeWidth={1.75} />
              Write the marker
            </Button>
          </div>
        }
      >
        <TextInput
          value={draft}
          onChange={setDraft}
          placeholder="auth-flow"
          autoFocus
          onSubmit={apply}
          hint={`<!-- zdraft: ${draft.trim() || "auth-flow"} -->`}
        />
      </Modal>
    </>
  );
}


function suggest(id: string): string {
  const [engine, ordinal] = id.split(":");
  return ordinal === undefined ? id : `${engine}-${Number(ordinal) + 1}`;
}
