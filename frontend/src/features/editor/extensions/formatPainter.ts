import { Extension } from "@tiptap/core";
import type { Attrs, Mark } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";

export interface FormatPainterOptions {
  /**
   * Mark types the painter never touches -- neither picked up from the source
   * nor stripped from the target. A link's href is a destination rather than
   * formatting, so carrying it onto unrelated text would be surprising.
   */
  excludedMarks: string[];
}

/** The textblock style behind the caret: paragraph vs heading, plus alignment. */
interface CapturedBlock {
  typeName: string;
  attrs: Attrs;
}

interface CapturedFormat {
  marks: readonly Mark[];
  block: CapturedBlock | null;
}

interface PainterState {
  format: CapturedFormat;
  /**
   * Word and Google Docs both keep the painter loaded after a double-click and
   * release it after a single one. Sticky mode survives until Escape or a click
   * on the toolbar button.
   */
  isSticky: boolean;
}

/**
 * Plugin state holds the captured formatting while the painter is armed, and
 * null while it is idle. Keeping it in editor state rather than React means the
 * toolbar reflects it through the same transaction subscription as every other
 * active state, and an empty mark set stays meaningfully distinct from "off" --
 * picking up unformatted text is a real request to clear formatting.
 */
export const formatPainterPluginKey = new PluginKey<PainterState | null>("formatPainter");

export function getPainterState(state: EditorState): PainterState | null {
  return formatPainterPluginKey.getState(state) ?? null;
}

function captureFormat(state: EditorState, excludedMarks: string[]): CapturedFormat {
  const { selection, storedMarks } = state;
  const { $from, $to, empty } = selection;

  // `marksAcross` reports the marks at the start of a range; `storedMarks` holds
  // formatting toggled at a caret before any character has been typed.
  const marks = empty ? storedMarks ?? $from.marks() : $from.marksAcross($to) ?? $from.marks();

  return {
    marks: marks.filter((mark) => !excludedMarks.includes(mark.type.name)),
    // `attrs` carries the heading level and, once TextAlign is registered, the
    // alignment -- so both ride along without being enumerated here.
    block: $from.parent.isTextblock
      ? { typeName: $from.parent.type.name, attrs: { ...$from.parent.attrs } }
      : null,
  };
}

/**
 * The word surrounding `pos`, or null if there is none. Word and Google Docs
 * both let a bare click paint the word under it rather than doing nothing.
 */
function wordRangeAt(state: EditorState, pos: number): { from: number; to: number } | null {
  const $pos = state.doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent.isTextblock) return null;

  // A single-character placeholder for leaf nodes keeps string offsets aligned
  // with document positions.
  const text = parent.textBetween(0, parent.content.size, undefined, "￼");
  const offset = $pos.parentOffset;

  let start = offset;
  let end = offset;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  while (end < text.length && !/\s/.test(text[end])) end += 1;
  if (start === end) return null;

  const blockStart = $pos.start();
  return { from: blockStart + start, to: blockStart + end };
}

function paintFormat(
  state: EditorState,
  tr: Transaction,
  format: CapturedFormat,
  excludedMarks: string[],
  markRange: { from: number; to: number },
): Transaction {
  const { from, to } = markRange;

  if (to > from) {
    // Clear only the types the painter manages, so a link inside the target
    // range survives being painted over.
    Object.values(state.schema.marks)
      .filter((type) => !excludedMarks.includes(type.name))
      .forEach((type) => tr.removeMark(from, to, type));

    format.marks.forEach((mark) => tr.addMark(from, to, mark));
  }

  if (format.block) {
    const type = state.schema.nodes[format.block.typeName];
    // Applied across the selection rather than the word range, so painting a
    // heading or an alignment affects whole paragraphs the way both Word and
    // Google Docs do.
    if (type?.isTextblock) {
      tr.setBlockType(state.selection.from, state.selection.to, type, format.block.attrs);
    }
  }

  return tr;
}

/** The range a paste should cover: the selection, or the word under a caret. */
function targetRange(state: EditorState) {
  const { selection } = state;
  if (!selection.empty) return { from: selection.from, to: selection.to };
  return wordRangeAt(state, selection.from) ?? { from: selection.from, to: selection.from };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    formatPainter: {
      /** Pick up the formatting at the current selection and arm the painter. */
      copyFormat: (options?: { isSticky?: boolean }) => ReturnType;
      /** Stamp the captured formatting onto the selection, or the word at the caret. */
      pasteFormat: () => ReturnType;
      /** Release the painter without applying. */
      cancelFormatPainter: () => ReturnType;
    };
  }
}

export const FormatPainter = Extension.create<FormatPainterOptions>({
  name: "formatPainter",

  addOptions() {
    return { excludedMarks: ["link"] };
  },

  addCommands() {
    return {
      copyFormat:
        ({ isSticky = false } = {}) =>
        ({ state, tr, dispatch }) => {
          const format = captureFormat(state, this.options.excludedMarks);
          dispatch?.(tr.setMeta(formatPainterPluginKey, { format, isSticky }));
          return true;
        },

      pasteFormat:
        () =>
        ({ state, tr, dispatch }) => {
          const painter = getPainterState(state);
          if (!painter) return false;

          if (dispatch) {
            const range = targetRange(state);
            paintFormat(state, tr, painter.format, this.options.excludedMarks, range);
            if (!painter.isSticky) tr.setMeta(formatPainterPluginKey, null);
            dispatch(tr);
          }

          return true;
        },

      cancelFormatPainter:
        () =>
        ({ state, tr, dispatch }) => {
          // Returning false when idle leaves Escape available to other handlers.
          if (!getPainterState(state)) return false;
          dispatch?.(tr.setMeta(formatPainterPluginKey, null));
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Google Docs' bindings. Word uses Mod-Shift-C/V, but those collide with
      // the browser's inspector and paste-without-formatting.
      "Mod-Alt-c": () => this.editor.commands.copyFormat(),
      "Mod-Alt-v": () => this.editor.commands.pasteFormat(),
      Escape: () => this.editor.commands.cancelFormatPainter(),
    };
  },

  addProseMirrorPlugins() {
    const { excludedMarks } = this.options;

    return [
      new Plugin<PainterState | null>({
        key: formatPainterPluginKey,

        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(formatPainterPluginKey) as PainterState | null | undefined;
            return meta === undefined ? value : meta;
          },
        },

        props: {
          handleDOMEvents: {
            mouseup: (view) => {
              if (!getPainterState(view.state)) return false;

              // ProseMirror settles the DOM selection into editor state from its
              // own mouse handling, which runs after this listener -- reading the
              // selection now would still see the pre-drag one. Defer a tick so
              // the release lands on the range the user actually dragged out.
              window.setTimeout(() => {
                if (view.isDestroyed) return;

                const painter = getPainterState(view.state);
                if (!painter) return;

                const range = targetRange(view.state);
                const tr = paintFormat(
                  view.state,
                  view.state.tr,
                  painter.format,
                  excludedMarks,
                  range,
                );
                if (!painter.isSticky) tr.setMeta(formatPainterPluginKey, null);
                view.dispatch(tr);
              }, 0);

              // Never claim the event -- the click must still move the caret.
              return false;
            },
          },
        },
      }),
    ];
  },
});
