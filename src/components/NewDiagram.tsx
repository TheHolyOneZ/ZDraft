import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FileCode2, FolderOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_STARTER,
  EXTENSION_FOR,
  STARTERS,
  nameProblem,
  starterById,
  withExtension,
} from "../core/starters";
import { isTauri } from "../lib/tauri";
import { useDocumentStore } from "../store/useDocumentStore";
import { useToastStore } from "../store/useToastStore";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { Button, Modal, Select, TextInput, type SelectOption } from "./ui";


export function NewDiagram({
  open,
  onClose,

  dir,
  onShowTemplates,
}: {
  open: boolean;
  onClose(): void;
  dir?: string | null;
  onShowTemplates?(): void;
}) {
  const root = useWorkspaceStore((s) => s.root);
  const setRoot = useWorkspaceStore((s) => s.setRoot);
  const refresh = useWorkspaceStore((s) => s.refresh);
  const createFile = useDocumentStore((s) => s.createFile);
  const push = useToastStore((s) => s.push);

  const [name, setName] = useState("diagram");
  const [starterId, setStarterId] = useState(DEFAULT_STARTER.id);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const target = dir ?? root;
  const starter = starterById(starterId) ?? DEFAULT_STARTER;
  const extension = EXTENSION_FOR[starter.engine];


  useEffect(() => {
    if (!open) return;
    setName("diagram");
    setBusy(false);
    setFailure(null);
  }, [open]);

  const problem = useMemo(() => nameProblem(name), [name]);
  const fileName = problem ? "" : withExtension(name, extension);

  const options: SelectOption<string>[] = STARTERS.map((s) => ({
    value: s.id,
    label: s.label,
    description: s.description,
  }));

  const pickFolder = async () => {
    if (!isTauri()) return;
    const chosen = await openDialog({ directory: true, multiple: false, title: "Open a folder" });
    if (typeof chosen === "string") setRoot(chosen);
  };

  const create = async () => {
    if (problem || !target || busy) return;

    setBusy(true);
    setFailure(null);
    try {
      await createFile(target, fileName, starter.source, starter.engine);
      refresh();
      onClose();
      push({ kind: "success", title: `Created ${fileName}` });
    } catch (e) {


      setFailure(String((e as { message?: string })?.message ?? e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New diagram"
      description={
        target
          ? "One file, written where you are looking. Nothing else is created."
          : "Choose a folder for it to live in."
      }
      width={470}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void create()} disabled={!target || !!problem || busy}>
            <FileCode2 size={13} strokeWidth={1.75} />
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Row label="Name">
          <TextInput
            value={name}
            onChange={(v) => {
              setName(v);
              setFailure(null);
            }}
            placeholder="diagram"
            suffix={extension}
            autoFocus
            invalid={problem ?? failure}
            hint={target ? `${target}/${fileName}` : undefined}
            onSubmit={() => void create()}
          />
        </Row>

        <Row label="Starts as">
          <Select
            value={starterId}
            options={options}
            onChange={setStarterId}
            menuWidth={340}
            block
          />
        </Row>


        {onShowTemplates && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onShowTemplates();
            }}
            className="focus-ring -mx-1 cursor-pointer rounded px-1 text-left text-[11px]"
            style={{ color: "var(--text-3)" }}
          >
            Or start from a <span style={{ color: "var(--accent)" }}>worked example</span> — C4,
            sequences, schemas, deployments.
          </button>
        )}

        {!target && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
            style={{ background: "var(--control)", border: "1px solid var(--border)" }}
          >
            <span className="text-[12px]" style={{ color: "var(--text-3)" }}>
              No folder is open.
            </span>
            <Button onClick={() => void pickFolder()}>
              <FolderOpen size={13} strokeWidth={1.75} />
              Open folder
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[10px] font-semibold tracking-[0.08em] uppercase"
        style={{ color: "var(--text-3)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
