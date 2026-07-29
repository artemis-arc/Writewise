import { useId, useState } from "react";
import type { FormEvent } from "react";
import type { Editor } from "@tiptap/react";

interface FontSizeFieldProps {
  editor: Editor;
  /** The selection's font size as a CSS length, or "" when it has none. */
  value: string;
}

/** Offered in the dropdown, but any size in range can be typed. */
const PRESET_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72] as const;

const MIN_SIZE = 1;
const MAX_SIZE = 400;
const FALLBACK_SIZE = 16;

/** "18px" -> 18. Anything not expressible as a number becomes null. */
function parseSize(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampSize(size: number) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(size)));
}

/**
 * Word and Google Docs both use an editable size box with steppers rather than a
 * fixed dropdown, so arbitrary sizes are typeable here too.
 */
export function FontSizeField({ editor, value }: Readonly<FontSizeFieldProps>) {
  const currentSize = parseSize(value);
  const listId = useId();

  // Null means "show whatever the caret reports". A string means the user is
  // mid-edit and their keystrokes win. Holding it as an override rather than
  // mirroring the prop is what keeps the box following the caret without an
  // effect to sync the two.
  const [draft, setDraft] = useState<string | null>(null);
  const displayedSize = draft ?? (currentSize === null ? "" : String(currentSize));

  const applySize = (size: number | null) => {
    const chain = editor.chain().focus();
    if (size === null) chain.unsetFontSize().run();
    else chain.setFontSize(`${clampSize(size)}px`).run();
  };

  const commitDraft = () => {
    if (draft === null) return;

    const parsed = parseSize(draft);
    // An emptied box means "back to the document default"; anything
    // unparseable is discarded by falling back to the caret's own size.
    if (draft.trim() === "") applySize(null);
    else if (parsed !== null) applySize(parsed);

    setDraft(null);
  };

  const stepSize = (delta: number) => {
    const base = currentSize ?? parseSize(draft ?? "") ?? FALLBACK_SIZE;
    setDraft(null);
    applySize(base + delta);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitDraft();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => stepSize(-1)}
        title="Decrease font size"
        aria-label="Decrease font size"
        className="flex h-8 w-6 items-center justify-center rounded-lg text-sm font-bold text-foreground/60 transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        −
      </button>

      <input
        list={listId}
        inputMode="numeric"
        value={displayedSize}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        placeholder="--"
        title="Font size"
        aria-label="Font size"
        className="h-8 w-12 rounded-lg border border-border-subtle bg-surface px-2 text-center text-xs text-foreground placeholder:text-foreground/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />
      <datalist id={listId}>
        {PRESET_SIZES.map((size) => (
          <option key={size} value={size} />
        ))}
      </datalist>

      <button
        type="button"
        onClick={() => stepSize(1)}
        title="Increase font size"
        aria-label="Increase font size"
        className="flex h-8 w-6 items-center justify-center rounded-lg text-sm font-bold text-foreground/60 transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        +
      </button>
    </form>
  );
}
