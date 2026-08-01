import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface KeystrokeEvent {
  /** `KeyboardEvent.key` -- the character or named key produced. */
  key: string;
  /** `KeyboardEvent.code` -- the physical key, independent of layout. */
  code: string;
  /** Milliseconds since the page's time origin, taken from the DOM event. */
  timestamp: number;
  /** Milliseconds since the previous keyup; null for the first one. */
  interKeyInterval: number | null;
  modifiers: {
    alt: boolean;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
  };
  /** Caret head position in the document at keyup. */
  caret: number;
  /** The serialized document at this keyup. */
  text: string;
}

export interface KeystrokeLoggerOptions {
  /** Called once per keyup. Leave null to make the extension inert. */
  onKeystroke: ((event: KeystrokeEvent) => void) | null;
  /** How the document is snapshotted on each keyup. Swap in Markdown/LaTeX later. */
  serialize: (editor: Editor) => string;
}

export interface KeystrokeLoggerStorage {
  /**
   * Every keyup so far, oldest first. The log is owned by the extension rather
   * than by a React ref so that reading it never interacts with rendering --
   * reach for it as `editor.storage.keystrokeLogger.events`.
   */
  events: KeystrokeEvent[];
}

declare module "@tiptap/core" {
  interface Storage {
    keystrokeLogger: KeystrokeLoggerStorage;
  }
}

export const keystrokeLoggerPluginKey = new PluginKey("keystrokeLogger");

export const KeystrokeLogger = Extension.create<KeystrokeLoggerOptions, KeystrokeLoggerStorage>({
  name: "keystrokeLogger",

  addOptions() {
    return {
      onKeystroke: null,
      serialize: (editor) => editor.getText(),
    };
  },

  addStorage() {
    return { events: [] };
  },

  addProseMirrorPlugins() {
    const { editor, options, storage } = this;

    // Lives in the plugin closure rather than extension storage: it is
    // bookkeeping for the next interval, not state anything else should read.
    let previousTimestamp: number | null = null;

    return [
      new Plugin({
        key: keystrokeLoggerPluginKey,
        props: {
          handleDOMEvents: {
            keyup: (view, event) => {
              // `event.timeStamp` is stamped when the event is created rather
              // than when this handler runs, so the intervals derived from it
              // are not skewed by whatever else is on the main thread.
              const timestamp = event.timeStamp;

              const keystroke: KeystrokeEvent = {
                key: event.key,
                code: event.code,
                timestamp,
                interKeyInterval:
                  previousTimestamp === null ? null : timestamp - previousTimestamp,
                modifiers: {
                  alt: event.altKey,
                  ctrl: event.ctrlKey,
                  meta: event.metaKey,
                  shift: event.shiftKey,
                },
                caret: view.state.selection.head,
                text: options.serialize(editor),
              };

              previousTimestamp = timestamp;
              storage.events.push(keystroke);
              options.onKeystroke?.(keystroke);

              // Never claim the event -- logging must not alter editing behaviour.
              return false;
            },
          },
        },
      }),
    ];
  },
});
