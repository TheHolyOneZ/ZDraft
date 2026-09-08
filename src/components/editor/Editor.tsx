import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo as cmRedo,
  undo as cmUndo,
  undoDepth,
} from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import {
  Annotation,
  Compartment,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

import type { SourceRange } from "../../core/model/scene";
import { useHistoryStore } from "../../store/useHistoryStore";
import { languageFor } from "./language";


const externalSync = Annotation.define<boolean>();


const setLocated = StateEffect.define<(SourceRange & { fading?: boolean }) | null>();


const FLASH_MS = 900;
const FADE_MS = 400;

const locatedField = StateField.define<DecorationSet>({
  create: () => Decoration.none,

  update(value, tr) {
    value = value.map(tr.changes);

    for (const effect of tr.effects) {
      if (!effect.is(setLocated)) continue;
      const range = effect.value;
      if (!range || range.from === range.to) return Decoration.none;

      const to = Math.min(range.to, tr.state.doc.length);
      const from = Math.min(range.from, to);
      value = Decoration.set([
        Decoration.mark({ class: effect.value.fading ? "cm-located cm-located-fading" : "cm-located" }).range(
          from,
          to,
        ),
      ]);
    }

    return value;
  },

  provide: (f) => EditorView.decorations.from(f),
});

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "var(--surface-2)",
    color: "var(--text)",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono, 'JetBrains Mono Variable', monospace)",

    lineHeight: "1.6",
    padding: "10px 0",
    caretColor: "var(--accent)",
  },
  ".cm-scroller": { overflow: "auto" },
  ".cm-gutters": {
    backgroundColor: "var(--surface-2)",
    color: "var(--text-3)",
    border: "none",
    paddingRight: "4px",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--text-2)" },
  ".cm-activeLine": { backgroundColor: "var(--row-hover)" },


  ".cm-selectionBackground": { backgroundColor: "var(--selection)" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "var(--selection)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
  ".cm-content ::selection, .cm-content::selection, .cm-line::selection": {
    backgroundColor: "var(--selection)",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--accent-soft)",
    outline: "1px solid var(--accent-line)",
  },


  ".cm-located": {
    backgroundColor: "var(--accent-soft)",
    boxShadow: "inset 2px 0 0 var(--accent)",
    borderRadius: "2px",
    transition: "background-color 400ms ease-out, box-shadow 400ms ease-out",
  },
  ".cm-located-fading": {
    backgroundColor: "transparent",
    boxShadow: "inset 2px 0 0 transparent",
  },
  ".cm-line": { padding: "0 12px" },
});


export interface EditorHandle {
  undo(): void;
  redo(): void;
}

export interface EditorProps {
  value: string;
  engine: string;
  onChange(value: string): void;

  onCursor?(offset: number): void;

  locate?: SourceRange | null;
  readOnly?: boolean;
  handle?: Ref<EditorHandle>;


  valueOrigin?: "file" | "edit";
}


const EDITOR_SEARCH_KEYMAP = searchKeymap.filter(
  (binding) => binding.key !== "Mod-g" && binding.key !== "Mod-Shift-g",
);

export function Editor({
  value,
  engine,
  onChange,
  onCursor,
  locate,
  readOnly,
  handle,
  valueOrigin = "file",
}: EditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageRef = useRef(new Compartment());


  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursor);
  onChangeRef.current = onChange;
  onCursorRef.current = onCursor;


  const depthRef = useRef(0);
  const originRef = useRef(valueOrigin);
  originRef.current = valueOrigin;

  useImperativeHandle(
    handle,
    () => ({
      undo: () => {
        const view = viewRef.current;
        if (view) cmUndo(view);
      },
      redo: () => {
        const view = viewRef.current;
        if (view) cmRedo(view);
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          locatedField,
          languageRef.current.of(languageFor(engine)),
          keymap.of([...defaultKeymap, ...historyKeymap, ...EDITOR_SEARCH_KEYMAP, indentWithTab]),
          editorTheme,
          EditorView.lineWrapping,
          EditorState.readOnly.of(Boolean(readOnly)),
          EditorView.updateListener.of((update) => {
            const external = update.transactions.some((t) => t.annotation(externalSync));

            if (update.docChanged && !external) {
              onChangeRef.current(update.state.doc.toString());
            }


            const depth = undoDepth(update.state);
            if (!external && depth > depthRef.current) {
              useHistoryStore.getState().record({ kind: "source", label: "Undo typing" });
            }
            depthRef.current = depth;

            if (update.selectionSet) {
              onCursorRef.current?.(update.state.selection.main.head);
            }
          }),
        ],
      }),
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;

    const fromApp = originRef.current === "edit";

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },


      annotations: fromApp
        ? [externalSync.of(true)]
        : [externalSync.of(true), Transaction.addToHistory.of(false)],
    });

    if (fromApp) {
      const depth = undoDepth(view.state);
      if (depth > depthRef.current) {
        useHistoryStore.getState().record({ kind: "source", label: "Undo the edit" });
      }
      depthRef.current = depth;
      return;
    }


    depthRef.current = undoDepth(view.state);
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: languageRef.current.reconfigure(languageFor(engine)) });
  }, [engine]);


  useEffect(() => {
    const view = viewRef.current;
    if (!view || !locate) return;

    const to = Math.min(locate.to, view.state.doc.length);
    const from = Math.min(locate.from, to);


    const editorHasFocus = view.hasFocus;

    view.dispatch({
      effects: [setLocated.of(locate), EditorView.scrollIntoView(from, { y: "center" })],
      ...(editorHasFocus ? {} : { selection: { anchor: from, head: to } }),
    });


    const fade = window.setTimeout(() => {
      viewRef.current?.dispatch({ effects: setLocated.of({ ...locate, fading: true }) });
    }, FLASH_MS);
    const clear = window.setTimeout(() => {
      viewRef.current?.dispatch({ effects: setLocated.of(null) });
    }, FLASH_MS + FADE_MS);

    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(clear);
    };
  }, [locate]);

  return <div ref={hostRef} className="h-full min-h-0 w-full overflow-hidden" />;
}
