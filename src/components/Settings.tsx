import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FolderOpen,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DIAGRAM_THEMES } from "../core/theme";
import { About } from "./About";
import { forgetPlantUmlProbe, probePlantUml } from "../lib/plantumlRunner";
import { api, isTauri, type PlantUmlProbe } from "../lib/tauri";
import { APP_THEMES, useSettingsStore, type AppTheme } from "../store/useSettingsStore";
import { useDocumentStore } from "../store/useDocumentStore";
import { useToastStore } from "../store/useToastStore";
import {
  Button,
  Checkbox,
  Field,
  IconButton,
  Modal,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  TextInput,
  type SelectOption,
} from "./ui";


type Tab = "settings" | "about";

export function Settings({ open, onClose }: { open: boolean; onClose(): void }) {
  const s = useSettingsStore();
  const [tab, setTab] = useState<Tab>("settings");


  useEffect(() => {
    if (open) setTab("settings");
  }, [open]);

  const themeOptions = useMemo<SelectOption<string>[]>(
    () =>
      DIAGRAM_THEMES.map((t) => ({
        value: t.id,
        label: t.label,
        description: t.note,
        swatch: [t.background, t.nodeFill, t.nodeStroke, t.edge, t.accent],
      })),
    [],
  );

  const appThemeOptions = useMemo<SelectOption<AppTheme>[]>(
    () => APP_THEMES.map((t) => ({ value: t.id, label: t.label, description: t.note })),
    [],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      description={
        tab === "settings"
          ? "Stored on this machine. ZDraft has no account and sends nothing anywhere."
          : undefined
      }
      width={560}
      tabs={
        <SegmentedControl<Tab>
          aria-label="Settings section"
          value={tab}
          onChange={setTab}
          segments={[
            {
              value: "settings",
              label: "Preferences",
              icon: <SlidersHorizontal size={13} strokeWidth={1.75} />,
            },
            { value: "about", label: "About", icon: <Info size={13} strokeWidth={1.75} /> },
          ]}
        />
      }
      footer={
        <>


          {tab === "settings" && (
            <Button onClick={() => s.reset()}>
              <RotateCcw size={13} strokeWidth={1.75} />
              Reset to defaults
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {tab === "about" ? (
        <About />
      ) : (
        <>
          <Section title="Appearance">
            <Field label="App theme" description="The chrome around your diagram.">
              <Select value={s.appTheme} options={appThemeOptions} onChange={s.setAppTheme} menuWidth={280} />
            </Field>

            <Field
              label="Default diagram theme"
              description="Used by files that have not chosen one of their own."
            >
              <Select
                value={s.diagramTheme}
                options={themeOptions}
                onChange={s.setDiagramTheme}
                menuWidth={300}
              />
            </Field>
          </Section>

          <Section title="Canvas">
            <Field
              label="Snap to grid"
              description="Dragged nodes land on this grid. Hold Alt while dragging to place freely; arrow-key nudges always ignore it."
            >
              <div className="w-[190px]">
                <Slider
                  value={s.gridSnap}
                  min={0}
                  max={32}
                  step={4}
                  onChange={s.setGridSnap}
                  format={(v) => (v === 0 ? "off" : `${v} px`)}
                />
              </div>
            </Field>

            <Field label="Show the drafting grid" description="The faint rule behind the canvas.">
              <Switch checked={s.showGrid} onChange={(v) => s.set("showGrid", v)} />
            </Field>

            <Field
              label="Animate layout changes"
              description="Nodes glide to their new positions when the layout re-runs, so you can see what moved. Dragging is never animated."
            >
              <Switch checked={s.animateLayout} onChange={(v) => s.set("animateLayout", v)} />
            </Field>

            <Field
              label="Dim unrelated edges"
              description="With something selected, edges that do not touch it fade back."
            >
              <Switch checked={s.dimUnrelated} onChange={(v) => s.set("dimUnrelated", v)} />
            </Field>

            <Field label="Minimap" description="An overview in the corner for large diagrams.">
              <Switch checked={s.showMinimap} onChange={(v) => s.set("showMinimap", v)} />
            </Field>
          </Section>

          <Section title="Editor">
            <Field
              label="Re-render as you type"
              description="Off means the canvas only updates on Ctrl+Enter."
            >
              <Switch checked={s.autoRender} onChange={(v) => s.set("autoRender", v)} />
            </Field>

            <Field label="Line numbers">
              <Checkbox checked={s.lineNumbers} onChange={(v) => s.set("lineNumbers", v)} />
            </Field>

            <Field label="Wrap long lines">
              <Checkbox checked={s.editorWrap} onChange={(v) => s.set("editorWrap", v)} />
            </Field>

            <Field label="Layout" description="Where the source sits relative to the canvas.">
              <SegmentedControl
                aria-label="Split layout"
                size="sm"
                value={s.splitMode}
                onChange={s.setSplitMode}
                segments={[
                  { value: "vertical", label: "Side" },
                  { value: "horizontal", label: "Stacked" },
                  { value: "canvas", label: "Canvas" },
                ]}
              />
            </Field>
          </Section>

          <PlantUmlSection />
        </>
      )}
    </Modal>
  );
}


function PlantUmlSection() {
  const jar = useSettingsStore((s) => s.plantumlJar);
  const setJar = useSettingsStore((s) => s.setPlantumlJar);

  const [probe, setProbe] = useState<PlantUmlProbe | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [installDir, setInstallDir] = useState<string | null>(null);
  const push = useToastStore((s) => s.push);

  const check = useCallback(async (force: boolean) => {
    setChecking(true);
    try {
      forgetPlantUmlProbe();
      setProbe(await probePlantUml(force));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check(false);
  }, [check, jar]);


  useEffect(() => {
    if (!isTauri()) return;
    void api.plantumlInstallDir().then(setInstallDir, () => setInstallDir(null));
  }, []);

  const install = async () => {
    setInstalling(true);
    setFailure(null);
    try {
      const path = await api.plantumlInstall();


      await check(true);


      const doc = useDocumentStore.getState();
      if (doc.engine === "plantuml") doc.setSource(doc.source, true);

      push({ kind: "success", title: "PlantUML installed", body: path });
    } catch (e) {
      const error = e as { message?: string; remedy?: string };
      setFailure([error.message, error.remedy].filter(Boolean).join(" "));
    } finally {
      setInstalling(false);
    }
  };

  const pickJar = async () => {
    if (!isTauri()) return;
    const chosen = await openDialog({
      multiple: false,
      title: "Find plantuml.jar",
      filters: [{ name: "Java archive", extensions: ["jar"] }],
    });
    if (typeof chosen === "string") setJar(chosen);
  };

  const ready = Boolean(probe?.version);

  return (
    <Section title="PlantUML">
      <p className="mb-2 text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        PlantUML is a Java program. ZDraft does not ship it — that would add 30 MB to every
        download for an engine most people never open, and it would still need a Java runtime
        anyway. Graphviz, Mermaid and D2 all work without any of this.
      </p>

      <div
        className="mb-3 flex items-start gap-2.5 rounded-lg px-3 py-2.5"
        style={{
          background: "var(--control)",
          border: `1px solid ${ready ? "color-mix(in srgb, var(--ok) 40%, transparent)" : "var(--border)"}`,
        }}
      >
        <span className="mt-[1px] shrink-0" style={{ color: ready ? "var(--ok)" : "var(--text-3)" }}>
          {checking ? (
            <Loader2 size={14} strokeWidth={1.75} className="spin" />
          ) : ready ? (
            <CheckCircle2 size={14} strokeWidth={1.75} />
          ) : (
            <AlertTriangle size={14} strokeWidth={1.75} />
          )}
        </span>

        <div className="min-w-0 flex-1 text-[12px]">
          {checking ? (
            <span style={{ color: "var(--text-3)" }}>Checking…</span>
          ) : ready ? (
            <>
              <div style={{ color: "var(--text)" }}>{probe!.version}</div>
              <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                {sourceLabel(probe!)} · {probe!.jar}
              </div>
              <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                {probe!.java}
              </div>
            </>
          ) : (
            <>
              <div style={{ color: "var(--text)" }}>{missingPart(probe, jar)}</div>
              <div className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
                {missingRemedy(probe, jar)}
              </div>
            </>
          )}
        </div>

        <IconButton
          icon={<RefreshCw size={13} strokeWidth={1.75} />}
          onClick={() => void check(true)}
          title="Check again"
          size={24}
        />
      </div>

      {!ready && (
        <div className="mb-3 flex flex-col gap-2">
          {probe?.java === null ? (


            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              Install a Java runtime first — <Code>sudo pacman -S jre-openjdk</Code> on Arch,{" "}
              <Code>sudo apt install default-jre</Code> on Debian or Ubuntu, or{" "}
              <a
                href="https://adoptium.net"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent)" }}
              >
                adoptium.net
              </a>{" "}
              on Windows. Then come back here.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={() => void install()} disabled={installing}>
                  {installing ? (
                    <Loader2 size={13} strokeWidth={1.75} className="spin" />
                  ) : (
                    <Download size={13} strokeWidth={1.75} />
                  )}
                  {installing ? "Downloading…" : "Install PlantUML"}
                </Button>
                <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                  ~30 MB, from plantuml.com's GitHub releases.
                </span>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                This is the only time ZDraft uses the network, and only because you asked. It
                puts the file in{" "}
                {installDir ? <Code>{installDir}</Code> : <Code>~/.local/share/plantuml</Code>} and
                checks it runs before keeping it.
              </p>

              <details className="text-[11px]" style={{ color: "var(--text-3)" }}>
                <summary className="cursor-pointer">Rather do it yourself?</summary>
                <div className="mt-1.5 flex flex-col gap-1 leading-relaxed">
                  <span>
                    Install your distribution's package —{" "}
                    <Code>sudo pacman -S plantuml</Code> or <Code>sudo apt install plantuml</Code> —
                    and ZDraft will find it.
                  </span>
                  <span>
                    Or download <Code>plantuml.jar</Code> from plantuml.com and drop it in{" "}
                    {installDir ? <Code>{installDir}</Code> : <Code>~/.local/share/plantuml</Code>},
                    which ZDraft searches. Anywhere else works too — point at it below.
                  </span>
                </div>
              </details>
            </>
          )}

          {failure && (
            <div
              className="rounded-lg px-3 py-2 text-[11px] leading-snug"
              style={{ background: "var(--control)", border: "1px solid var(--error)", color: "var(--text-2)" }}
            >
              {failure}
            </div>
          )}
        </div>
      )}


      <div className="flex items-start gap-2">
        <TextInput
          className="flex-1"
          value={jar}
          onChange={setJar}
          placeholder="Found automatically"
          hint="Leave empty to look in the usual install locations."
        />
        <Button className="h-8" onClick={() => void pickJar()}>
          <FolderOpen size={13} strokeWidth={1.75} />
          Find it
        </Button>
      </div>
    </Section>
  );
}


function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="rounded px-1 py-0.5 font-mono text-[10px]"
      style={{ background: "var(--input)", color: "var(--text-2)" }}
    >
      {children}
    </code>
  );
}

function sourceLabel(probe: PlantUmlProbe): string {
  switch (probe.jarSource) {
    case "configured":
      return "You set this path";
    case "environment":
      return "From PLANTUML_JAR";
    case "discovered":
      return "Found automatically";
    default:
      return "";
  }
}


function missingPart(probe: PlantUmlProbe | null, configured: string): string {
  if (!probe) return "PlantUML needs the desktop app.";
  if (!probe.java) return "Java is not installed, or not on the PATH.";

  const stale = configured.trim() !== "" && probe.jarSource !== "configured";
  if (!probe.jar) {
    return stale
      ? "The path set below does not exist, and no other plantuml.jar was found."
      : "Java is installed, but plantuml.jar was not found.";
  }
  if (stale) return "The path set below does not exist, so ZDraft is using the one it found.";

  return "That file did not run as PlantUML.";
}

function missingRemedy(probe: PlantUmlProbe | null, configured: string): string {
  if (!probe) return "Open ZDraft as an app rather than in the browser preview.";
  if (!probe.java) return "Install a Java runtime — JRE 8 or newer.";

  if (configured.trim() !== "" && probe.jarSource !== "configured") {
    return "Clear the box below to search the usual locations, or point it at the jar itself.";
  }
  if (!probe.jar) {
    return "Install it with the button below, or point at a jar you already have.";
  }
  return "Point at the plantuml.jar file itself, and check the download is not truncated.";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3
        className="mb-1 text-[10px] font-semibold tracking-[0.08em] uppercase"
        style={{ color: "var(--text-3)" }}
      >
        {title}
      </h3>
      <div style={{ borderTop: "1px solid var(--border)" }}>{children}</div>
    </section>
  );
}
