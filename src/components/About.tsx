import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import iconUrl from "../assets/icon-256.png";
import { isTauri } from "../lib/tauri";
import { toast } from "../store/useToastStore";


export function About() {
  return (
    <>
      <header className="mb-4 flex items-center gap-4">
        <img
          src={iconUrl}
          alt=""
          width={80}
          height={80}
          className="shrink-0 rounded-[18px]"
          style={{ boxShadow: "var(--shadow-2)" }}
        />
        <div className="min-w-0">
          <h2
            className="text-[20px] leading-tight font-semibold tracking-[-0.01em]"
            style={{ color: "var(--text)" }}
          >
            ZDraft
          </h2>
          <p className="tnum selectable mt-0.5 text-[11px]" style={{ color: "var(--text-3)" }}>
            Version {__APP_VERSION__} · GPL-3.0-or-later
          </p>
          <p className="mt-1.5 text-[12px] leading-snug" style={{ color: "var(--text-2)" }}>
            Diagrams as code, with a canvas you are allowed to touch.
          </p>
        </div>
      </header>

      <p className="mb-4 text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        You write the diagram in Mermaid, Graphviz, D2 or PlantUML. ZDraft draws it, and lets you
        move the box auto-layout put in the wrong place. The move is kept in a small readable file
        beside your source, so the diagram file stays exactly what the engine expects — GitHub still
        renders it, and the diff a reviewer reads is still text.
      </p>

      <Group title="Made by">
        <Row label="Author" value="TheHolyOneZ" />
        <Link
          label="ZDraft"
          href="https://zsync.eu/zdraft/"
          text="zsync.eu/zdraft"
          note="Downloads and what is new. The installers are only here."
        />
        <Link
          label="Source and issues"
          href="https://github.com/TheHolyOneZ/ZDraft"
          text="github.com/TheHolyOneZ/ZDraft"
          note="The code, the history, and where to report a bug."
        />
        <Link
          label="Other projects"
          href="https://zsync.eu/"
          text="zsync.eu"
          note="Everything else I have built."
        />
        <Link
          label="Game mods"
          href="https://zlogic.eu/"
          text="zlogic.eu"
          note="Mods and mod menus, which are a different job entirely."
        />
      </Group>

      <Group title="What it does with your data">
        <p className="py-2 text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Nothing leaves this machine. No account, no telemetry, no sync, no cloud. ZDraft reads and
          writes the files you point it at and nothing else, and the only thing it ever downloads is
          PlantUML — when you press the button that says so.
        </p>
      </Group>

      <Group title="Built with">
        <Row label="Tauri 2" value="The desktop shell. Rust does the filesystem, the atomic sidecar writes, the git reads and the PDF." />
        <Row label="React 19 · TypeScript" value="The canvas, and the whole layout engine — which is why the CLI can share it." />
        <Row label="CodeMirror 6" value="The source editor, with a mode per language." />
        <Row label="Tailwind · Motion · Zustand" value="Chrome, animation and state." />
      </Group>

      <Group title="Engines">
        <Row label="Graphviz" value="Bundled as WebAssembly, so a diagram renders the same on a machine without it installed." />
        <Row label="Mermaid" value="Bundled. Pinned, and held to a fixture corpus so an upgrade cannot move your diagrams quietly." />
        <Row label="D2" value="Bundled as WebAssembly." />
        <Row label="PlantUML" value="Not bundled — it needs Java, and 30 MB in every installer for an engine most people will not use is not a trade ZDraft makes. Settings will install it for you." />
      </Group>

      <Group title="Typefaces">
        <Row
          label="Inter · JetBrains Mono"
          value="Bundled under the SIL Open Font License, and embedded in exports so a diagram looks the same on a machine that has neither."
        />
      </Group>

      <p className="mt-4 text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
        ZDraft is free software under the GNU General Public License, version 3 or later. Free
        forever, source public, donations welcome and never required.
      </p>
    </>
  );
}


function Group({ title, children }: { title: string; children: ReactNode }) {
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


function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4 py-2">
      <span
        className="w-[124px] shrink-0 text-[12px] font-medium"
        style={{ color: "var(--text)" }}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1 text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
        {value}
      </span>
    </div>
  );
}


function Link({
  label,
  href,
  text,
  note,
}: {
  label: string;
  href: string;
  text: string;

  note?: string;
}) {
  const go = async () => {
    try {
      if (isTauri()) await openUrl(href);
      else window.open(href, "_blank", "noopener");
    } catch {
      toast.error("Could not open the link", href);
    }
  };

  return (
    <div className="flex items-baseline gap-4 py-2">
      <span
        className="w-[124px] shrink-0 text-[12px] font-medium"
        style={{ color: "var(--text)" }}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => void go()}
          className="focus-ring inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded text-[11px] transition-colors"
          style={{ color: "var(--accent)" }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          <span className="truncate">{text}</span>
          <ExternalLink size={11} strokeWidth={1.75} className="shrink-0" />
        </button>
        {note && (
          <div className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
            {note}
          </div>
        )}
      </div>
    </div>
  );
}
