"use client";

import { useCallback, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { KeystrokeLogger } from "@/features/editor/extensions/keystrokeLogger";
import type { KeystrokeEvent } from "@/features/editor/extensions/keystrokeLogger";

const PLACEHOLDER = "Begin your intellectual exploration here...";

// Folds to `false` at build time, so production never registers the logger and
// never runs a keyup handler. The extension module itself is still bundled --
// it is a couple of hundred bytes of dead code, not a runtime cost.
const IS_DEV = process.env.NODE_ENV !== "production";

function formatInterval(interval: number | null) {
  return interval === null ? "first" : `+${Math.round(interval)}ms`;
}

export function RichTextEditor() {
  // Only the count is React state. The events themselves accumulate in the
  // extension's storage (`editor.storage.keystrokeLogger.events`), keeping the
  // growing array out of the render path entirely.
  const [loggedCount, setLoggedCount] = useState(0);

  const handleKeystroke = useCallback((event: KeystrokeEvent) => {
    // `console.log` rather than `console.debug` on purpose: debug maps to the
    // Verbose level, which DevTools hides under its default log-level filter.
    // The full event (including the serialized document) is the second argument
    // so it stays expandable without flooding the line.
    console.log(
      `[keystroke] ${event.key} ${formatInterval(event.interKeyInterval)} caret=${event.caret} chars=${event.text.length}`,
      event,
    );

    setLoggedCount((count) => count + 1);
  }, []);

  const editor = useEditor({
    // The App Router prerenders this component on the server. Rendering the
    // editor during that pass produces a hydration mismatch, so the first
    // paint is deferred to the client -- `editor` is null until then.
    immediatelyRender: false,

    // StarterKit already bundles bold, italic, underline, strike, code,
    // headings, lists, blockquote, horizontal rule, link and undo/redo.
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: PLACEHOLDER }),
      CharacterCount,
      ...(IS_DEV ? [KeystrokeLogger.configure({ onKeystroke: handleKeystroke })] : []),
    ],

    editorProps: {
      attributes: {
        class: "manuscript",
        spellcheck: "true",
        "aria-label": "Manuscript",
      },
    },
  });

  const counts = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      words: instance?.storage.characterCount.words() ?? 0,
      characters: instance?.storage.characterCount.characters() ?? 0,
    }),
  });

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm">
      {editor && <EditorToolbar editor={editor} />}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} className="h-full" />
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-4 py-2 text-xs text-foreground/50">
        <span>{(counts?.words ?? 0).toLocaleString()} words</span>
        {IS_DEV && (
          <span title="Keyup events written to the console (development only)">
            {loggedCount.toLocaleString()} keyups logged
          </span>
        )}
        <span>{(counts?.characters ?? 0).toLocaleString()} characters</span>
      </div>
    </div>
  );
}
