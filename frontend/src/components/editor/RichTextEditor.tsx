"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorToolbar } from "@/components/editor/EditorToolbar";

const PLACEHOLDER = "Begin your intellectual exploration here...";

export function RichTextEditor() {
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
        <span>{(counts?.characters ?? 0).toLocaleString()} characters</span>
      </div>
    </div>
  );
}
