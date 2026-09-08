import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus2,
  FileText,
  FolderOpen,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { baseName } from "../lib/path";
import { api, isTauri, type FolderEntry } from "../lib/tauri";
import { useDocumentStore } from "../store/useDocumentStore";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { useToastStore } from "../store/useToastStore";
import {
  Button,
  ContextMenu,
  EmptyState,
  IconButton,
  SectionHeader,
  Tooltip,
  useContextMenu,
  type MenuItem,
} from "./ui";


export function FileTree({ onNew }: { onNew(): void }) {
  const root = useWorkspaceStore((s) => s.root);
  const setRoot = useWorkspaceStore((s) => s.setRoot);
  const closeRoot = useWorkspaceStore((s) => s.closeRoot);
  const version = useWorkspaceStore((s) => s.version);


  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [root, version]);

  const pickFolder = useCallback(async () => {
    if (!isTauri()) return;
    const chosen = await open({ directory: true, multiple: false, title: "Open a folder" });
    if (typeof chosen === "string") setRoot(chosen);
  }, [setRoot]);

  return (
    <div className="flex min-h-0 flex-col" style={{ maxHeight: "40%" }}>
      <SectionHeader
        actions={
          root ? (
            <>
              <IconButton
                icon={<FilePlus2 size={12} strokeWidth={1.75} />}
                onClick={onNew}
                title="New diagram"
                shortcut="Ctrl N"
                size={22}
              />
              <IconButton
                icon={<RefreshCw size={12} strokeWidth={1.75} />}
                onClick={() => useWorkspaceStore.getState().refresh()}
                title="Refresh"
                size={22}
              />
              <IconButton
                icon={<FolderOpen size={12} strokeWidth={1.75} />}
                onClick={pickFolder}
                title="Open a different folder"
                size={22}
              />
            </>
          ) : null
        }
      >
        {root ? baseName(root) : "Files"}
      </SectionHeader>

      {!root ? (
        <EmptyState
          title="No folder open"
          body={
            isTauri()
              ? "Point ZDraft at a folder of diagrams. It reads what is there and writes nothing you did not ask for."
              : "Open a folder in the desktop app. The browser preview has no filesystem."
          }
          action={
            isTauri() ? (
              <Button variant="primary" onClick={pickFolder}>
                <FolderOpen size={13} strokeWidth={1.75} />
                Open folder
              </Button>
            ) : undefined
          }
        />
      ) : missing ? (
        <EmptyState
          title="That folder is gone"
          body={
            <>


              <Tooltip label={root}>
                <span className="font-medium" style={{ color: "var(--text-2)" }}>
                  {baseName(root)}
                </span>
              </Tooltip>{" "}
              could not be read. It may have been renamed, moved or unmounted.
            </>
          }
          action={
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={pickFolder}>
                <FolderOpen size={13} strokeWidth={1.75} />
                Open folder
              </Button>
              <Button onClick={closeRoot}>Forget it</Button>
            </div>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <Directory path={root} depth={0} onMissing={() => setMissing(true)} onNew={onNew} />
        </div>
      )}
    </div>
  );
}

function Directory({
  path,
  depth,
  onMissing,
  onNew,
}: {
  path: string;
  depth: number;

  onMissing?: () => void;

  onNew?: () => void;
}) {
  const [entries, setEntries] = useState<FolderEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const version = useWorkspaceStore((s) => s.version);
  const onMissingRef = useRef(onMissing);
  onMissingRef.current = onMissing;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    api
      .listFolder(path)
      .then((list) => !cancelled && setEntries(list))
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onMissingRef.current?.();
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);


  if (failed) {
    return (
      <div
        className="px-3 py-1 text-[11px]"
        style={{ paddingLeft: 12 + depth * 12, color: "var(--text-3)" }}
      >
        Could not be read
      </div>
    );
  }

  if (!entries) {

    return (
      <div className="space-y-1 px-3 py-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-3.5" style={{ width: `${70 - i * 12}%` }} />
        ))}
      </div>
    );
  }


  if (entries.length === 0) {
    return onNew ? (
      <EmptyState
        title="Nothing here yet"
        body="This folder has no diagrams in it."
        action={
          <Button variant="primary" onClick={onNew}>
            <FilePlus2 size={13} strokeWidth={1.75} />
            New diagram
          </Button>
        }
      />
    ) : (
      <div
        className="px-3 py-1 text-[11px]"
        style={{ paddingLeft: 12 + depth * 12, color: "var(--text-3)" }}
      >
        Empty
      </div>
    );
  }

  return (
    <>
      {entries.map((entry) => (
        <Entry key={entry.path} entry={entry} depth={depth} />
      ))}
    </>
  );
}

function Entry({ entry, depth }: { entry: FolderEntry; depth: number }) {
  const [open, setOpen] = useState(false);
  const currentPath = useDocumentStore((s) => s.path);
  const openFile = useDocumentStore((s) => s.openFile);
  const menu = useContextMenu();
  const push = useToastStore((s) => s.push);

  const indent = 10 + depth * 12;
  const isFolder = entry.kind === "folder";
  const active = currentPath === entry.path;


  const openable = entry.kind === "diagram" || entry.kind === "document";

  return (
    <>
      <button
        type="button"
        disabled={!isFolder && !openable}
        onContextMenu={(e) => menu.openAt(e)}
        onClick={() => (isFolder ? setOpen((v) => !v) : void openFile(entry.path))}
        className="focus-ring flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[12px] transition-colors"
        style={{
          paddingLeft: indent,
          background: active ? "var(--row-selected)" : "transparent",
          color: active ? "var(--text)" : openable || isFolder ? "var(--text-2)" : "var(--text-3)",
          cursor: isFolder || openable ? "pointer" : "default",
        }}
        onPointerEnter={(e) => {
          if (!active && (isFolder || openable)) e.currentTarget.style.background = "var(--row-hover)";
        }}
        onPointerLeave={(e) => {
          if (!active) e.currentTarget.style.background = "transparent";
        }}
      >
        {isFolder ? (
          open ? (
            <ChevronDown size={12} strokeWidth={2} className="shrink-0" />
          ) : (
            <ChevronRight size={12} strokeWidth={2} className="shrink-0" />
          )
        ) : entry.kind === "diagram" ? (
          <FileCode2 size={12} strokeWidth={1.75} className="shrink-0" style={{ color: "var(--accent)" }} />
        ) : (
          <FileText size={12} strokeWidth={1.75} className="shrink-0" />
        )}

        <span className="truncate">{entry.name}</span>


        {entry.has_layout && (
          <MapPin size={10} strokeWidth={2} className="ml-auto shrink-0" style={{ color: "var(--pin)" }} />
        )}
      </button>

      <ContextMenu
        anchor={menu.anchor}
        onClose={menu.close}
        items={entryMenu({
          entry,
          openFile,
          push,
          refresh: () => useWorkspaceStore.getState().refresh(),
          reopen: () => {


            if (useDocumentStore.getState().path === entry.path) void openFile(entry.path);
          },
        })}
      />

      {isFolder && open && <Directory path={entry.path} depth={depth + 1} />}
    </>
  );
}


function entryMenu({
  entry,
  openFile,
  push,
  refresh,
  reopen,
}: {
  entry: FolderEntry;
  openFile(path: string): Promise<void>;
  push: ReturnType<typeof useToastStore.getState>["push"];
  refresh(): void;
  reopen(): void;
}): MenuItem[] {
  const items: MenuItem[] = [];
  const openable = entry.kind === "diagram" || entry.kind === "document";

  if (openable) {
    items.push({ id: "open", label: "Open", onSelect: () => void openFile(entry.path) });
  }

  items.push({
    id: "reveal",
    label: "Show in file manager",
    onSelect: () => {
      if (isTauri()) void revealItemInDir(entry.path);
    },
  });

  items.push({
    id: "copy",
    label: "Copy path",
    onSelect: () => {
      const write = isTauri() ? writeText : navigator.clipboard.writeText.bind(navigator.clipboard);
      void Promise.resolve(write(entry.path)).then(
        () => push({ kind: "success", title: "Path copied" }),
        () => push({ kind: "error", title: "Could not copy the path" }),
      );
    },
  });

  if (entry.has_layout) {
    items.push({ id: "sep", label: "", separator: true });
    items.push({
      id: "release",
      label: "Back to auto-layout",
      danger: true,
      onSelect: () => {
        void api
          .deleteLayout(entry.path)
          .then(() => {
            refresh();
            reopen();
            push({
              kind: "success",
              title: `Released ${entry.name}`,
              body: "Its layout file is gone; the diagram is back to pure auto-layout.",
            });
          })
          .catch((e: Error) =>
            push({ kind: "error", title: "Could not delete the layout file", body: e.message }),
          );
      },
    });
  }

  return items;
}
