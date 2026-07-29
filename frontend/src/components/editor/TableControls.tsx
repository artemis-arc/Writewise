import type { Editor } from "@tiptap/react";
import { ToolbarButton, ToolbarDivider } from "@/components/editor/ToolbarButton";

interface TableControlsProps {
  editor: Editor;
}

/**
 * Contextual row shown only while the caret is inside a table. Every command
 * here is valid for any cell, so none of them need a disabled state.
 */
export function TableControls({ editor }: Readonly<TableControlsProps>) {
  return (
    <div
      role="toolbar"
      aria-label="Table"
      aria-orientation="horizontal"
      className="flex flex-wrap items-center gap-1 border-b border-border-subtle bg-surface-muted px-3 py-2"
    >
      <span className="mr-1 text-xs font-semibold tracking-wide text-brand uppercase">Table</span>

      <ToolbarButton
        label="Add row above"
        onClick={() => editor.chain().focus().addRowBefore().run()}
      >
        ↑ Row
      </ToolbarButton>
      <ToolbarButton
        label="Add row below"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        ↓ Row
      </ToolbarButton>
      <ToolbarButton label="Remove row" onClick={() => editor.chain().focus().deleteRow().run()}>
        ✕ Row
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Add column left"
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      >
        ← Col
      </ToolbarButton>
      <ToolbarButton
        label="Add column right"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        → Col
      </ToolbarButton>
      <ToolbarButton
        label="Remove column"
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        ✕ Col
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Toggle header row"
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
      >
        Header
      </ToolbarButton>
      <ToolbarButton
        label="Merge or split cells"
        onClick={() => editor.chain().focus().mergeOrSplit().run()}
      >
        Merge
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Delete table"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        Delete
      </ToolbarButton>
    </div>
  );
}
