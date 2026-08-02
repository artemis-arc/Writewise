"use client";

import { useCallback, useState } from "react";
import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { FormatPainter } from "@/features/editor/extensions/formatPainter";
import { KeystrokeLogger } from "@/features/editor/extensions/keystrokeLogger";
import type { KeystrokeEvent } from "@/features/editor/extensions/keystrokeLogger";
import { isAllowedLinkHref } from "@/features/editor/links";

const PLACEHOLDER = "Begin your intellectual exploration here...";

// Folds to `false` at build time, so production never registers the logger and
// never runs a keyup handler. The extension module itself is still bundled --
// it is a couple of hundred bytes of dead code, not a runtime cost.
const IS_DEV =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.NODE_ENV !== "production";

export interface UseManuscriptEditorOptions {
  /** Called with the editor's plain text on every document change -- what autosave listens to. */
  onTextChange?: (text: string) => void;
}

export interface UseManuscriptEditorResult {
  editor: Editor | null;
  /** Keyups recorded by the dev-only logger. Always 0 in production. */
  keystrokeCount: number;
}

function formatInterval(interval: number | null) {
  return interval === null ? "first" : `+${Math.round(interval)}ms`;
}

/**
 * The manuscript editor instance and its extension set, in one place so every
 * surface that shows a manuscript -- the standalone /write page and the task
 * definition wizard's writing step -- gets the same document model, toolbar
 * capabilities and instrumentation.
 */
export function useManuscriptEditor(
  options: UseManuscriptEditorOptions = {},
): UseManuscriptEditorResult {
  const { onTextChange } = options;

  // Only the count is React state. The events themselves accumulate in the
  // extension's storage (`editor.storage.keystrokeLogger.events`), keeping the
  // growing array out of the render path entirely.
  const [keystrokeCount, setKeystrokeCount] = useState(0);

  const handleKeystroke = useCallback((event: KeystrokeEvent) => {
    // `console.log` rather than `console.debug` on purpose: debug maps to the
    // Verbose level, which DevTools hides under its default log-level filter.
    // The full event (including the serialized document) is the second argument
    // so it stays expandable without flooding the line.
    console.log(
      `[keystroke] ${event.key} ${formatInterval(event.interKeyInterval)} caret=${event.caret} chars=${event.text.length}`,
      event,
    );

    setKeystrokeCount((count) => count + 1);
  }, []);

  const editor = useEditor({
    // The App Router prerenders this component on the server. Rendering the
    // editor during that pass produces a hydration mismatch, so the first
    // paint is deferred to the client -- `editor` is null until then.
    immediatelyRender: false,

    // StarterKit already bundles bold, italic, underline, strike, code,
    // headings, lists, blockquote, horizontal rule, link and undo/redo.
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          // Inside an editor a click should place the caret, not navigate away.
          openOnClick: false,
          defaultProtocol: "https",
          // Consulted by setLink, toggleLink, the input and paste rules, and
          // renderHTML -- so this one override covers every way an href gets
          // into the document and every way it gets back out.
          isAllowedUri: (href) => isAllowedLinkHref(href),
        },
      }),
      Placeholder.configure({ placeholder: PLACEHOLDER }),
      CharacterCount,

      // TextStyle is the mark that FontFamily, FontSize and Color write their
      // inline styles onto -- none of them work without it.
      TextStyle,
      FontFamily,
      FontSize,
      Color,

      // Adds a `textAlign` attribute to these nodes, which is also what lets the
      // format painter carry alignment across as a block style.
      TextAlign.configure({ types: ["heading", "paragraph"] }),

      // TableKit registers the table, row, cell and header nodes together.
      TableKit.configure({ table: { resizable: true } }),

      FormatPainter,

      ...(IS_DEV ? [KeystrokeLogger.configure({ onKeystroke: handleKeystroke })] : []),
    ],

    editorProps: {
      attributes: {
        class: "manuscript",
        spellcheck: "true",
        "aria-label": "Manuscript",
      },
    },

    // Autosave persists `contentText`, so it gets the plain text rather than the
    // marked-up document -- the same shape the plain textarea used to send.
    onUpdate: onTextChange ? ({ editor: instance }) => onTextChange(instance.getText()) : undefined,
  });

  return { editor, keystrokeCount };
}
