import { useId, useState } from "react";
// React's own synthetic event, not the global DOM `SubmitEvent` -- `onSubmit`
// hands over a React event and the two are not interchangeable.
import type { SubmitEvent } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/Button";
import { isAllowedLinkHref, normalizeLinkHref } from "@/features/editor/links";

interface LinkFormProps {
  editor: Editor;
  /** Pre-filled with the existing href when the caret sits on a link. */
  initialHref: string;
  onClose: () => void;
}

const INVALID_MESSAGE = "Use a web address (https://...) or an email address.";

export function LinkForm({ editor, initialHref, onClose }: Readonly<LinkFormProps>) {
  const [href, setHref] = useState(initialHref);
  const [error, setError] = useState("");
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    // `extendMarkRange` makes this apply to the whole link even when the caret
    // merely sits inside one rather than selecting it.
    const chain = editor.chain().focus().extendMarkRange("link");

    // Submitting an emptied field is the natural way to ask for removal.
    if (!href.trim()) {
      chain.unsetLink().run();
      onClose();
      return;
    }

    const normalized = normalizeLinkHref(href);

    // setLink screens the href itself and simply returns false when it objects,
    // which would close the form as though the link had been applied. Checking
    // first is what turns that silent no-op into a visible message.
    if (!isAllowedLinkHref(normalized)) {
      setError(INVALID_MESSAGE);
      return;
    }

    chain.setLink({ href: normalized }).run();
    onClose();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2"
    >
      <label
        htmlFor={fieldId}
        className="text-xs font-semibold tracking-wide text-brand uppercase"
      >
        Link
      </label>
      <input
        // The field only exists once the user has clicked the link button, so
        // taking focus is what they are asking for.
        autoFocus
        id={fieldId}
        // Deliberately not `type="url"`: native validation rejects a bare host
        // like "example.com" before submit, which normalizeLinkHref accepts.
        type="text"
        inputMode="url"
        value={href}
        onChange={(event) => {
          setHref(event.target.value);
          setError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        placeholder="https://example.com"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-muted px-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <Button type="submit" className="px-4 py-1.5 text-xs">
        Apply
      </Button>
      <Button type="button" variant="ghost" onClick={onClose} className="px-4 py-1.5 text-xs">
        Cancel
      </Button>

      {error && (
        <p id={errorId} role="alert" className="w-full text-xs font-medium text-red-500">
          {error}
        </p>
      )}
    </form>
  );
}
