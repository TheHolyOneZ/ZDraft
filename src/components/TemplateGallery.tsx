import { FileCode2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { isGraph, isSequence, type Scene } from "../core/model/scene";
import { sceneToSvg } from "../core/render/svg";
import { EXTENSION_FOR, nameProblem, withExtension } from "../core/starters";
import { templatesByCategory, type Template } from "../core/templates";
import { themeByName } from "../core/theme";
import { adapterFor, useDocumentStore } from "../store/useDocumentStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { toast } from "../store/useToastStore";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { Button, Modal, TextInput } from "./ui";


export function TemplateGallery({
  open,
  onClose,
  dir,
}: {
  open: boolean;
  onClose(): void;
  dir?: string | null;
}) {
  const root = useWorkspaceStore((s) => s.root);
  const refresh = useWorkspaceStore((s) => s.refresh);
  const createFile = useDocumentStore((s) => s.createFile);
  const themeName = useSettingsStore((s) => s.diagramTheme);

  const groups = useMemo(() => templatesByCategory(), []);
  const [selectedId, setSelectedId] = useState(groups[0]?.items[0]?.id ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => groups.flatMap((g) => g.items).find((t) => t.id === selectedId),
    [groups, selectedId],
  );


  const touched = useRef(false);
  useEffect(() => {
    if (!open) {
      touched.current = false;
      return;
    }
    if (!touched.current && selected) setName(slug(selected.name));
  }, [open, selected]);

  const target = dir ?? root;
  const theme = useMemo(() => themeByName(themeName), [themeName]);
  const preview = usePreview(open ? selected : undefined, theme);

  const problem = nameProblem(name);
  const fileName =
    problem || !selected ? "" : withExtension(name, EXTENSION_FOR[selected.engine]);

  const create = async () => {
    if (!selected || !target || problem || busy) return;

    setBusy(true);
    try {
      await createFile(target, fileName, selected.source, selected.engine);
      refresh();
      onClose();
      toast.success(`Created ${fileName}`, "Delete what does not apply and rename the rest.");
    } catch (e) {
      toast.error("Could not create the file", String((e as { message?: string })?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Templates"
      description="Worked examples, not stubs. Open one, delete what does not apply, and rename the rest."
      width={880}
      footer={
        <div className="flex w-full items-start gap-3">
          <div className="min-w-0 flex-1">
            <TextInput
              value={name}
              onChange={(v) => {
                touched.current = true;
                setName(v);
              }}
              placeholder="diagram"
              suffix={selected ? EXTENSION_FOR[selected.engine] : ""}
              invalid={problem}
              hint={target ? `${target}/${fileName}` : "No folder is open."}
              onSubmit={() => void create()}
            />
          </div>

          <Button className="h-8" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="h-8"
            variant="primary"
            onClick={() => void create()}
            disabled={!selected || !target || !!problem || busy}
          >
            <FileCode2 size={13} strokeWidth={1.75} />
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      }
    >
      <div className="flex gap-4" style={{ height: 420 }}>
        <div className="w-[260px] shrink-0 overflow-y-auto pr-1">
          {groups.map((group) => (
            <section key={group.category} className="mb-3">
              <h3
                className="mb-1 px-1 text-[10px] font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--text-3)" }}
              >
                {group.label}
              </h3>

              {group.items.map((template) => {
                const active = template.id === selectedId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedId(template.id)}
                    onDoubleClick={() => void create()}
                    className="focus-ring flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors"
                    style={{
                      background: active ? "var(--row-selected)" : "transparent",
                      border: `1px solid ${active ? "var(--accent-line)" : "transparent"}`,
                    }}
                  >
                    <span
                      className="flex w-full items-center gap-2 text-[12px] font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      <span className="min-w-0 flex-1 truncate">{template.name}</span>
                      <span className="shrink-0 text-[10px]" style={{ color: "var(--text-3)" }}>
                        {template.engine}
                      </span>
                    </span>
                    <span className="text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
                      {template.description}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>

        <div
          className="flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl p-3"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          {preview.status === "loading" ? (
            <span className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-3)" }}>
              <Loader2 size={13} strokeWidth={1.75} className="spin" />
              Laying it out…
            </span>
          ) : preview.status === "failed" ? (
            <span className="px-6 text-center text-[12px]" style={{ color: "var(--error)" }}>
              This template did not render. That is a bug in ZDraft, not in your setup.
            </span>
          ) : (


            <div
              className="h-full w-full [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain"
              dangerouslySetInnerHTML={{ __html: preview.svg }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

type Preview =
  | { status: "loading"; svg: "" }
  | { status: "ready"; svg: string }
  | { status: "failed"; svg: "" };


function usePreview(template: Template | undefined, theme: ReturnType<typeof themeByName>): Preview {
  const [state, setState] = useState<Preview>({ status: "loading", svg: "" });
  const cache = useRef(new Map<string, string>());

  useEffect(() => {
    if (!template) return;

    const key = `${template.id}:${theme.id}`;
    const hit = cache.current.get(key);
    if (hit !== undefined) {
      setState({ status: "ready", svg: hit });
      return;
    }

    let cancelled = false;
    setState({ status: "loading", svg: "" });

    void adapterFor(template.engine)
      .layout(template.source, { theme })
      .then((result) => {
        if (cancelled) return;
        if (!drawable(result.scene)) {
          setState({ status: "failed", svg: "" });
          return;
        }

        const svg = sceneToSvg(result.scene, theme, { padding: 12, background: false });
        cache.current.set(key, svg);
        setState({ status: "ready", svg });
      })
      .catch(() => !cancelled && setState({ status: "failed", svg: "" }));

    return () => {
      cancelled = true;
    };
  }, [template, theme]);

  return state;
}

function drawable(scene: Scene): boolean {
  if (isGraph(scene)) return scene.nodes.length > 0;
  if (isSequence(scene)) return scene.lifelines.length > 0;
  return true;
}


function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "diagram"
  );
}
