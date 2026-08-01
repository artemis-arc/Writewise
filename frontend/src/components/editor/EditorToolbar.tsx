import { useState } from "react";
import type { MouseEvent } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { ColorPicker } from "@/components/editor/ColorPicker";
import { FontSizeField } from "@/components/editor/FontSizeField";
import { LinkForm } from "@/components/editor/LinkForm";
import { TableControls } from "@/components/editor/TableControls";
import {
  ToolbarButton,
  ToolbarDivider,
  ToolbarSelect,
} from "@/components/editor/ToolbarButton";
import { getPainterState } from "@/features/editor/extensions/formatPainter";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BulletListIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  PaintBrushIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
  UndoIcon,
  UnlinkIcon,
} from "@/components/ui/icons";

interface EditorToolbarProps {
  editor: Editor;
}

// The empty value means "unset the mark". Tiptap preserves these strings
// verbatim, so they round-trip back into the select without normalisation.
const FONT_FAMILIES = [
  { value: "", label: "Default font" },
  { value: "var(--font-geist-sans), sans-serif", label: "Geist Sans" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "var(--font-geist-mono), monospace", label: "Geist Mono" },
] as const;

const DEFAULT_TABLE = { rows: 3, cols: 3, withHeaderRow: true };

const ALIGNMENTS = [
  { value: "left", label: "Align left", Icon: AlignLeftIcon },
  { value: "center", label: "Align center", Icon: AlignCenterIcon },
  { value: "right", label: "Align right", Icon: AlignRightIcon },
  { value: "justify", label: "Justify", Icon: AlignJustifyIcon },
] as const;

/** The painter button is the only control with three states, so it needs three labels. */
function painterLabel(isArmed: boolean, isSticky: boolean) {
  if (isSticky) return "Format painter locked -- click to release";
  if (isArmed) return "Release format painter";
  return "Copy formatting (double-click to keep)";
}

export function EditorToolbar({ editor }: Readonly<EditorToolbarProps>) {
  const [isLinkFormOpen, setIsLinkFormOpen] = useState(false);

  // Subscribing through a selector keeps the toolbar from re-rendering on every
  // transaction -- it only re-renders when one of these values actually changes.
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      // TextAlign is only registered for these types, so anywhere else the
      // alignment buttons would be inert and are disabled instead.
      const isAlignable = instance.isActive("paragraph") || instance.isActive("heading");

      return {
        isAlignable,
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
        isLink: instance.isActive("link"),
        isInTable: instance.isActive("table"),
        fontFamily: (instance.getAttributes("textStyle").fontFamily as string) ?? "",
        fontSize: (instance.getAttributes("textStyle").fontSize as string) ?? "",
        color: (instance.getAttributes("textStyle").color as string) ?? "",
        linkHref: (instance.getAttributes("link").href as string) ?? "",
        // Unaligned nodes store no attribute at all, but both Word and Google
        // Docs still show left as the active choice, so fall back for display.
        textAlign: isAlignable
          ? ((instance.getAttributes("paragraph").textAlign ??
              instance.getAttributes("heading").textAlign ??
              "left") as string)
          : "",
        // Booleans rather than the captured marks themselves -- useEditorState
        // deep-compares the selector result, and comparing ProseMirror marks on
        // every transaction would be needless work.
        isPainterArmed: getPainterState(instance.state) !== null,
        isPainterSticky: getPainterState(instance.state)?.isSticky ?? false,
        canUndo: instance.can().undo(),
        canRedo: instance.can().redo(),
      };
    },
  });

  const handleFontFamily = (value: string) => {
    const chain = editor.chain().focus();
    if (value) chain.setFontFamily(value).run();
    else chain.unsetFontFamily().run();
  };

  // A single click arms the painter for one use and a second releases it; a
  // double-click keeps it loaded, matching Word and Google Docs.
  const handlePainterClick = (event: MouseEvent<HTMLButtonElement>) => {
    const chain = editor.chain().focus();
    if (state.isPainterArmed && event.detail === 1) chain.cancelFormatPainter().run();
    else chain.copyFormat({ isSticky: event.detail > 1 }).run();
  };

  return (
    // Spans the whole window under the TopBar now that the editor is full-bleed,
    // so the horizontal padding matches the TopBar's rather than a card's.
    <div className="shrink-0 bg-surface">
      <div
        role="toolbar"
        aria-label="Formatting"
        aria-orientation="horizontal"
        className="flex flex-wrap items-center gap-1 border-b border-border-subtle px-6 py-2"
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
        <ToolbarButton
          label={painterLabel(state.isPainterArmed, state.isPainterSticky)}
          isActive={state.isPainterArmed}
          onClick={handlePainterClick}
        >
          <PaintBrushIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarSelect
          label="Font family"
          value={state.fontFamily}
          options={FONT_FAMILIES}
          onChange={handleFontFamily}
          previewOptionFont
          className="max-w-36"
        />
        <FontSizeField editor={editor} value={state.fontSize} />

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
        <ColorPicker editor={editor} value={state.color} />

        <ToolbarDivider />

        {ALIGNMENTS.map(({ value, label, Icon }) => (
          <ToolbarButton
            key={value}
            label={label}
            isActive={state.textAlign === value}
            isDisabled={!state.isAlignable}
            onClick={() => editor.chain().focus().setTextAlign(value).run()}
          >
            <Icon className="h-4 w-4" />
          </ToolbarButton>
        ))}

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

        <ToolbarDivider />

        <ToolbarButton
          label={state.isLink ? "Edit link" : "Insert link"}
          isActive={state.isLink || isLinkFormOpen}
          onClick={() => setIsLinkFormOpen((open) => !open)}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Remove link"
          isDisabled={!state.isLink}
          onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          <UnlinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Insert table"
          onClick={() => editor.chain().focus().insertTable(DEFAULT_TABLE).run()}
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {isLinkFormOpen && (
        <LinkForm
          // Remounting on href change keeps the input seeded from whichever link
          // the caret is on, rather than stale state from the last one edited.
          key={state.linkHref}
          editor={editor}
          initialHref={state.linkHref}
          onClose={() => setIsLinkFormOpen(false)}
        />
      )}

      {state.isInTable && <TableControls editor={editor} />}
    </div>
  );
}
