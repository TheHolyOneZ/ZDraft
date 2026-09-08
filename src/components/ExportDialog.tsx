import interFontUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import { ClipboardCopy, Copy, FileCode2, FileImage, FileText, ImageDown } from "lucide-react";
import { useMemo, useState } from "react";

import { isPassthrough } from "../core/model/scene";
import { sceneToSvg } from "../core/render/svg";
import type { DiagramTheme } from "../core/theme";
import { api, describeError, isTauri } from "../lib/tauri";
import { useDocumentStore } from "../store/useDocumentStore";
import { toast } from "../store/useToastStore";
import { Button, Checkbox, Field, Modal, SegmentedControl, Select, Slider } from "./ui";

type Format = "svg" | "png" | "pdf";


type TextMode = "keep" | "embed" | "outline";

const TEXT_MODES: readonly { value: TextMode; label: string; description: string }[] = [
  {
    value: "keep",
    label: "Leave it as text",
    description: "Smallest, and still selectable. Needs Inter on the machine that opens it.",
  },
  {
    value: "embed",
    label: "Embed the font",
    description: "Adds about 100 KB. Identical anywhere, and still selectable.",
  },
  {
    value: "outline",
    label: "Draw it as outlines",
    description: "Letters become shapes. Identical anywhere, and no longer searchable.",
  },
];


const FORMAT_NOTE: Record<Format, string> = {
  svg: "Vector and still text. Scales forever, and the labels stay searchable.",
  png: "A picture. Everything pastes it; nothing can edit it afterwards.",
  pdf: "Vector, one page the size of the diagram, with the type drawn as outlines \u2014 it prints the same on any machine.",
};


export function ExportDialog({
  open,
  onClose,
  theme,
}: {
  open: boolean;
  onClose(): void;
  theme: DiagramTheme;
}) {
  const scene = useDocumentStore((s) => s.scene);
  const source = useDocumentStore((s) => s.source);
  const name = useDocumentStore((s) => s.name);
  const path = useDocumentStore((s) => s.path);

  const [format, setFormat] = useState<Format>("svg");
  const [scale, setScale] = useState(2);
  const [background, setBackground] = useState(true);
  const [padding, setPadding] = useState(16);
  const [text, setText] = useState<TextMode>("keep");
  const [busy, setBusy] = useState(false);


  const exportable = scene ?? null;


  const annotations = useDocumentStore((s) => s.layout.annotations);
  const passthrough = Boolean(scene && isPassthrough(scene));

  const svg = useMemo(
    () =>
      exportable
        ? sceneToSvg(exportable, theme, {
            padding,
            background,
            scale: 1,
            title: name,
            annotations,
          })
        : "",
    [exportable, theme, padding, background, name, annotations],
  );


  const rasterSvg = () =>
    exportable
      ? sceneToSvg(exportable, theme, { padding, background, scale, title: name, annotations })
      : "";

  const baseName = name.replace(/\.[^.]+$/, "") || "diagram";

  const saveFile = async () => {
    if (!exportable) return;

    if (!isTauri()) {
      toast.error("Export needs the desktop app", "The browser preview cannot write files.");
      return;
    }

    setBusy(true);
    try {
      if (format === "svg") {
        const target = await save({
          title: "Export SVG",
          defaultPath: `${baseName}.svg`,
          filters: [{ name: "SVG", extensions: ["svg"] }],
        });
        if (!target) return;


        await api.writeFile(target, await svgForExport());
        toast.success("Exported", target);
      } else if (format === "png") {
        const target = await save({
          title: "Export PNG",
          defaultPath: `${baseName}.png`,
          filters: [{ name: "PNG", extensions: ["png"] }],
        });
        if (!target) return;

        const bytes = await rasterise(rasterSvg());
        await api.writeBytes(target, [...bytes]);
        toast.success("Exported", target);
      } else {
        const target = await save({
          title: "Export PDF",
          defaultPath: `${baseName}.pdf`,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (!target) return;


        await api.writePdf(target, svg);
        toast.success("Exported", target);
      }
    } catch (e) {
      toast.error(
        "Export failed",
        e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
      );
    } finally {
      setBusy(false);
    }
  };


  const textMode: TextMode = passthrough && text === "embed" ? "keep" : text;

  const svgForExport = async (): Promise<string> => {
    if (textMode === "outline") return api.outlineSvg(svg);
    if (textMode === "embed") return embedFontsInto(svg);
    return svg;
  };

  const copySvg = async () => {
    try {
      await copy(await svgForExport(), "SVG");
    } catch (e) {
      toast.error("Could not copy the SVG", describeError(e).message);
    }
  };


  const copyImage = async () => {
    if (!exportable) return;

    setBusy(true);
    try {
      const bytes = await rasterise(rasterSvg());
      if (isTauri()) await writeImage(bytes);
      else {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": new Blob([bytes], { type: "image/png" }) }),
        ]);
      }
      toast.success("Image copied", `${scale}× PNG`);
    } catch (e) {
      toast.error("Could not copy the image", describeError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      if (isTauri()) await writeText(text);
      else await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error(`Could not copy the ${what.toLowerCase()}`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export"
      description={
        !exportable
          ? undefined
          : passthrough
            ? "This diagram is the engine's own drawing. It exports exactly as shown, with ZDraft's background and padding."
            : "Pins, ghosts and selection handles stay behind — they are ZDraft's state, not part of the diagram."
      }
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void saveFile()} disabled={!exportable || busy}>
            {busy ? "Exporting…" : `Save ${format.toUpperCase()}`}
          </Button>
        </>
      }
    >
      {!exportable ? (
        <p className="py-6 text-center text-[12px]" style={{ color: "var(--text-3)" }}>
          Nothing to export yet.
        </p>
      ) : (
        <>
          <div
            className="mb-3 flex items-center justify-center overflow-hidden rounded-xl p-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >

            <div
              className="max-h-[176px] w-full [&>svg]:mx-auto [&>svg]:max-h-[176px] [&>svg]:w-auto [&>svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>

          <Field label="Format" description={FORMAT_NOTE[format]}>
            <SegmentedControl<Format>
              aria-label="Format"
              size="sm"
              value={format}
              onChange={setFormat}
              segments={[
                { value: "svg", label: "SVG", icon: <FileCode2 size={13} strokeWidth={1.75} /> },
                { value: "png", label: "PNG", icon: <FileImage size={13} strokeWidth={1.75} /> },
                { value: "pdf", label: "PDF", icon: <FileText size={13} strokeWidth={1.75} /> },
              ]}
            />
          </Field>


          <Field
            label="Raster scale"
            description="Pixel size for PNG and for “Copy image”. SVG and PDF are vector and ignore it."
          >
            <div className="w-[190px]">
              <Slider value={scale} min={1} max={6} step={1} onChange={setScale} format={(v) => `${v}×`} />
            </div>
          </Field>

          <Field label="Padding" description="Space around the diagram in the exported file.">
            <div className="w-[190px]">
              <Slider
                value={padding}
                min={0}
                max={64}
                step={4}
                onChange={setPadding}
                format={(v) => `${v} px`}
              />
            </div>
          </Field>

          <Field
            label="Paint the background"
            description="Off leaves it transparent, for dropping onto a slide."
          >
            <Checkbox checked={background} onChange={setBackground} />
          </Field>

          {format === "svg" && (
            <Field
              label="The text"
              description={TEXT_MODES.find((m) => m.value === textMode)!.description}
            >


              <Select<TextMode>
                value={textMode}
                onChange={setText}
                options={


                  (passthrough ? TEXT_MODES.filter((m) => m.value !== "embed") : TEXT_MODES).map(
                    ({ value, label }) => ({ value, label }),
                  )
                }
              />
            </Field>
          )}

          <div className="mt-3 flex flex-wrap gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <Button onClick={() => void copySvg()}>
              <Copy size={13} strokeWidth={1.75} />
              Copy SVG
            </Button>
            <Button onClick={() => void copyImage()} disabled={busy}>
              <ImageDown size={13} strokeWidth={1.75} />
              Copy image
            </Button>
            <Button onClick={() => void copy(source, "Source")}>
              <ClipboardCopy size={13} strokeWidth={1.75} />
              Copy source for GitHub
            </Button>
            {path && (
              <span className="ml-auto self-center text-[11px]" style={{ color: "var(--text-3)" }}>
                {path}
              </span>
            )}
          </div>

          <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
            “Copy image” puts a {scale}× PNG on the clipboard, for pasting straight into a chat or a
            slide. “Copy source for GitHub” is the file verbatim — pins live in the sidecar, so the
            source you paste has never had anything added to it.
          </p>
        </>
      )}
    </Modal>
  );
}

let fontCss: string | null = null;


async function loadFontCss(): Promise<string> {
  if (fontCss !== null) return fontCss;

  try {
    const bytes = await (await fetch(interFontUrl)).arrayBuffer();
    const view = new Uint8Array(bytes);


    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < view.length; i += CHUNK) {
      binary += String.fromCharCode(...view.subarray(i, i + CHUNK));
    }

    fontCss =
      `@font-face{font-family:"Inter";font-style:normal;font-weight:100 900;` +
      `src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2");}` +
      `@font-face{font-family:"Inter Variable";font-style:normal;font-weight:100 900;` +
      `src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2");}`;
  } catch {


    fontCss = "";
  }

  return fontCss;
}


async function rasterise(svg: string): Promise<Uint8Array> {
  const withFonts = await embedFontsInto(svg);
  const blob = new Blob([withFonts], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not rasterise the diagram."));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth));
    canvas.height = Math.max(1, Math.round(image.naturalHeight));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not open a drawing context.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!out) throw new Error("Could not encode the PNG.");
    return new Uint8Array(await out.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}


export async function embedFontsInto(svg: string): Promise<string> {
  const css = await loadFontCss();
  return css ? svg.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`) : svg;
}


export async function fontsAvailable(): Promise<boolean> {
  return (await loadFontCss()) !== "";
}
