"use client";

import { useCallback, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import clsx from "clsx";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { FormatPainter, getPainterState } from "@/features/editor/extensions/formatPainter";
import { isAllowedLinkHref } from "@/features/editor/links";
import { KeystrokeLogger } from "@/features/editor/extensions/keystrokeLogger";
import type { KeystrokeEvent } from "@/features/editor/extensions/keystrokeLogger";
import { M2_CONFIDENCE_CUTOFF } from "../../lib/backend/config";
import { useStageClassification } from "@/features/editor/useStageClassification";
import type { StageTransition } from "@/features/editor/useStageClassification";
import { useFeedback } from "@/features/editor/useFeedback";
import { FeedbackPanel } from "@/components/editor/FeedbackPanel";

const PLACEHOLDER = "Begin your intellectual exploration here...";

// Folds to `false` at build time, so production never registers the logger and
// never runs a keyup handler. The extension module itself is still bundled --
// it is a couple of hundred bytes of dead code, not a runtime cost.
const IS_DEV =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.NODE_ENV !== "production";

export interface RichTextEditorStageSignal {
  stage: string | null;
  confidence: number | null;
  isConfident: boolean;
}

interface RichTextEditorProps {
  readonly onStageChange?: (signal: RichTextEditorStageSignal) => void;
}

function formatInterval(interval: number | null) {
  return interval === null ? "first" : `+${Math.round(interval)}ms`;
}

export function RichTextEditor(props: Readonly<RichTextEditorProps>) {
  const { onStageChange } = props;
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
  });

  const feedback = useFeedback();
  const { requestFeedback } = feedback;

  const handleStageTransition = useCallback(
    (transition: StageTransition) => {
      requestFeedback({
        sessionId: transition.sessionId,
        stage: transition.stage,
        content: transition.content,
      });
    },
    [requestFeedback],
  );

  const { scrollContainerRef } = useStageClassification(editor, {
    confidenceCutoff: M2_CONFIDENCE_CUTOFF,
    onStageChange,
    onStageTransition: handleStageTransition,
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      words: instance?.storage.characterCount.words() ?? 0,
      characters: instance?.storage.characterCount.characters() ?? 0,
      isPainterArmed: instance ? getPainterState(instance.state) !== null : false,
    }),
  });

  return (
    // `min-h-0` lets this pane shrink inside the page's flex column, which is
    // what confines the overflow to the scroll container below rather than
    // pushing the status bar off-screen.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
      {editor && <EditorToolbar editor={editor} />}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className={clsx(
            "min-h-0 flex-1 overflow-y-auto px-8 py-6",
            // Signals that the next selection will be painted rather than just made.
            editorState?.isPainterArmed && "manuscript-painting",
          )}
        >
          <EditorContent editor={editor} className="h-full" />
        </div>

        <FeedbackPanel
          status={feedback.status}
          pendingStage={feedback.pendingStage}
          history={feedback.history}
          error={feedback.error}
          onDismissError={feedback.dismissError}
        />
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-6 py-2 text-xs text-foreground/50">
        <div className="flex items-center gap-3">
          <span>{(editorState?.words ?? 0).toLocaleString()} words</span>
        </div>
        {IS_DEV && (
          <span title="Keyup events written to the console (development only)">
            {loggedCount.toLocaleString()} keyups logged
          </span>
        )}
        <span>{(editorState?.characters ?? 0).toLocaleString()} characters</span>
      </div>
    </div>
  );
}
