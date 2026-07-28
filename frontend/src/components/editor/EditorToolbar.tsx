import type { ReactNode } from "react";
import clsx from "clsx";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import {
  BoldIcon,
  BulletListIcon,
  CodeIcon,
  ItalicIcon,
  OrderedListIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UndoIcon,
} from "@/components/ui/icons";

interface EditorToolbarProps {
  editor: Editor;
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  /** Omit for one-shot commands (undo/redo) so they are not announced as toggles. */
  isActive?: boolean;
  isDisabled?: boolean;
  children: ReactNode;
}

function ToolbarButton({
  label,
  onClick,
  isActive,
  isDisabled,
  children,
}: Readonly<ToolbarButtonProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      className={clsx(
        "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-40",
        isActive ? "bg-brand text-brand-foreground" : "text-foreground/60 hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border-subtle" />;
}

export function EditorToolbar({ editor }: Readonly<EditorToolbarProps>) {
  // Subscribing through a selector keeps the toolbar from re-rendering on every
  // transaction -- it only re-renders when one of these flags actually flips.
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      isBold: instance.isActive("bold"),
      isItalic: instance.isActive("italic"),
      isUnderline: instance.isActive("underline"),
      isStrike: instance.isActive("strike"),
      isCode: instance.isActive("code"),
      isHeading1: instance.isActive("heading", { level: 1 }),
      isHeading2: instance.isActive("heading", { level: 2 }),
      isHeading3: instance.isActive("heading", { level: 3 }),
      isBulletList: instance.isActive("bulletList"),
      isOrderedList: instance.isActive("orderedList"),
      isBlockquote: instance.isActive("blockquote"),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border-subtle px-3 py-2"
    >
      <ToolbarButton
        label="Undo"
        isDisabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <UndoIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        isDisabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <RedoIcon className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Heading 1"
        isActive={state.isHeading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        isActive={state.isHeading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        isActive={state.isHeading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Bold"
        isActive={state.isBold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        isActive={state.isItalic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        isActive={state.isUnderline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        isActive={state.isStrike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        isActive={state.isCode}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Bulleted list"
        isActive={state.isBulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <BulletListIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        isActive={state.isOrderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <OrderedListIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Blockquote"
        isActive={state.isBlockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
