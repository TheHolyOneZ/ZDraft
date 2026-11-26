import { save } from "@tauri-apps/plugin-dialog";

import { useDocumentStore } from "../store/useDocumentStore";
import { toast } from "../store/useToastStore";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { baseName, dirName, joinPath, samePath, splitExtension } from "./path";
import { api, isTauri } from "./tauri";

export function withExtensionOf(target: string, original: string): string | null {
  const want = splitExtension(baseName(original)).ext;
  if (!want) return target;

  const have = splitExtension(baseName(target)).ext;
  if (!have) return `${target}.${want}`;
  return have.toLowerCase() === want.toLowerCase() ? target : null;
}

export async function saveAsDialog(from?: string): Promise<void> {
  if (!isTauri()) return;

  const doc = useDocumentStore.getState();
  const source = from ?? doc.path;
  const isOpen = source === null || (doc.path !== null && samePath(source, doc.path));

  const name = source ? baseName(source) : doc.name;
  const { stem, ext } = splitExtension(name);
  const folder = source ? dirName(source) : (useWorkspaceStore.getState().root ?? "");
  const suggested = `${stem}-copy${ext ? `.${ext}` : ""}`;

  const picked = await save({
    title: `Save ${name} as`,
    defaultPath: folder ? joinPath(folder, suggested) : suggested,
    filters: ext ? [{ name: `.${ext} diagram`, extensions: [ext] }] : undefined,
  });
  if (!picked) return;

  const target = withExtensionOf(picked, name);
  if (!target) {
    toast.error(
      `Keep the .${ext} ending`,
      "ZDraft picks the engine from a file's extension, so a copy has to keep it.",
    );
    return;
  }

  try {
    if (isOpen) {
      await useDocumentStore.getState().saveAs(target);
    } else {
      await useDocumentStore.getState().saveCopy(source!, target);
      await useDocumentStore.getState().openFile(target);
    }
    const withLayout = await api
      .layoutPathFor(target)
      .then((sidecar) => api.pathExists(sidecar))
      .catch(() => false);
    toast.success(
      `Saved as ${baseName(target)}`,
      withLayout ? "The diagram and its layout file, side by side." : undefined,
    );
  } catch (e) {
    toast.error(`Could not save ${baseName(target)}`, String((e as { message?: string })?.message ?? e));
  }
}
