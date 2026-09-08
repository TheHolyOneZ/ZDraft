import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ArrowRight, FileInput, FolderOpen, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatFor, importDiagram, ImportError, type Import } from "../core/import";
import { nameProblem, withExtension } from "../core/starters";
import { api, isTauri } from "../lib/tauri";
import { useDocumentStore } from "../store/useDocumentStore";
import { useToastStore } from "../store/useToastStore";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { Button, Modal, TextInput } from "./ui";


export function ImportDialog({
  open,
  onClose,
  dir,
}: {
  open: boolean;
  onClose(): void;
  dir?: string | null;
}) {
  const root = useWorkspaceStore((s) => s.root);
  const setRoot = useWorkspaceStore((s) => s.setRoot);
  const refresh = useWorkspaceStore((s) => s.refresh);
  const createImported = useDocumentStore((s) => s.createImported);
  const push = useToastStore((s) => s.push);

  const [source, setSource] = useState<{ path: string; result: Import } | null>(null);
  const [name, setName] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; remedy?: string } | null>(null);

  const target = dir ?? root;

  useEffect(() => {
    if (!open) return;
    setSource(null);
    setName("");
    setReading(false);
    setBusy(false);
    setFailure(null);
  }, [open]);

  const problem = useMemo(() => (name ? nameProblem(name) : null), [name]);
  const fileName = problem || !name ? "" : withExtension(name, ".mmd");

  const choose = async () => {
    if (!isTauri()) return;

    const chosen = await openDialog({
      multiple: false,
      title: "Import a diagram",
      filters: [
        { name: "Diagrams", extensions: ["drawio", "excalidraw", "xml"] },
        { name: "draw.io", extensions: ["drawio", "xml"] },
        { name: "Excalidraw", extensions: ["excalidraw"] },
      ],
    });
    if (typeof chosen !== "string") return;

    setReading(true);
    setFailure(null);
    try {


      const { text, name: base } = await api.readFile(chosen);


      const format = formatFor(base) ?? "drawio";
      const result = await importDiagram(text, format);

      setSource({ path: chosen, result });
      setName(base.replace(/\.(drawio\.xml|drawio|excalidraw|xml)$/i, "") || "diagram");
    } catch (e) {
      setFailure(
        e instanceof ImportError
          ? { message: e.message, remedy: e.remedy }
          : { message: String((e as { message?: string })?.message ?? e) },
      );
    } finally {
      setReading(false);
    }
  };

  const create = async () => {
    if (!source || !target || problem || !fileName || busy) return;

    setBusy(true);
    setFailure(null);
    try {
      await createImported(target, fileName, source.result.source, source.result.layout);
      refresh();
      onClose();
      push({
        kind: "success",
        title: `Imported ${fileName}`,
        body: `${source.result.counts.nodes} nodes, all pinned where they were.`,
      });
    } catch (e) {
      setFailure({ message: String((e as { message?: string })?.message ?? e) });
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import a diagram"
      description="From draw.io or Excalidraw. The layout comes with it — every box stays where you put it."
      width={520}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => void create()}
            disabled={!source || !target || !!problem || !fileName || busy}
          >
            <FileInput size={13} strokeWidth={1.75} />
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
          style={{ background: "var(--control)", border: "1px solid var(--border)" }}
        >
          <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--text-2)" }}>
            {source ? source.path : "No file chosen yet."}
          </span>
          <Button onClick={() => void choose()} disabled={reading}>
            <FolderOpen size={13} strokeWidth={1.75} />
            {reading ? "Reading…" : source ? "Choose another" : "Choose a file"}
          </Button>
        </div>

        {failure && (
          <div
            className="flex flex-col gap-1 rounded-lg px-3 py-2.5 text-[12px]"
            style={{ background: "var(--control)", border: "1px solid var(--error)" }}
          >
            <span style={{ color: "var(--text)" }}>{failure.message}</span>
            {failure.remedy && (
              <span style={{ color: "var(--text-3)" }}>{failure.remedy}</span>
            )}
          </div>
        )}

        {source && (
          <>
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-2)" }}>
              <Count n={source.result.counts.nodes} one="node" many="nodes" />
              <ArrowRight size={12} strokeWidth={1.75} style={{ color: "var(--text-3)" }} />
              <Count n={source.result.counts.edges} one="edge" many="edges" />
              {source.result.counts.groups > 0 && (
                <>
                  <ArrowRight size={12} strokeWidth={1.75} style={{ color: "var(--text-3)" }} />
                  <Count n={source.result.counts.groups} one="group" many="groups" />
                </>
              )}
              <span className="ml-auto" style={{ color: "var(--pin)" }}>
                all pinned
              </span>
            </div>


            <pre
              className="max-h-[180px] overflow-auto rounded-lg px-3 py-2.5 font-mono text-[11px] leading-relaxed"
              style={{
                background: "var(--input)",
                border: "1px solid var(--border)",
                color: "var(--text-2)",
              }}
            >
              {source.result.source}
            </pre>

            {source.result.warnings.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {source.result.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="flex items-start gap-2 text-[11px] leading-snug"
                    style={{ color: "var(--text-3)" }}
                  >
                    <TriangleAlert
                      size={12}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0"
                      style={{ color: "var(--warn)" }}
                    />
                    {warning}
                  </li>
                ))}
              </ul>
            )}

            <TextInput
              value={name}
              onChange={(v) => {
                setName(v);
                setFailure(null);
              }}
              placeholder="diagram"
              suffix=".mmd"
              invalid={problem}
              hint={target ? `${target}/${fileName}` : "No folder is open."}
              onSubmit={() => void create()}
            />
          </>
        )}

        {!target && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
            style={{ background: "var(--control)", border: "1px solid var(--border)" }}
          >
            <span className="text-[12px]" style={{ color: "var(--text-3)" }}>
              No folder is open.
            </span>
            <Button
              onClick={async () => {
                if (!isTauri()) return;
                const chosen = await openDialog({ directory: true, multiple: false });
                if (typeof chosen === "string") setRoot(chosen);
              }}
            >
              <FolderOpen size={13} strokeWidth={1.75} />
              Choose a folder
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Count({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <span>
      <span className="tnum font-medium" style={{ color: "var(--text)" }}>
        {n}
      </span>{" "}
      {n === 1 ? one : many}
    </span>
  );
}
