import type { Metadata } from "next";
import { TopBar } from "@/components/layout/TopBar";
import { RichTextEditor } from "@/components/editor/RichTextEditor";

export const metadata: Metadata = {
  title: "Write | WriteWise",
  description: "Draft and format your manuscript.",
};

export default function WritePage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar />

      <div className="flex-1 overflow-hidden px-6 py-6">
        <div className="mx-auto h-full w-full max-w-3xl">
          <RichTextEditor />
        </div>
      </div>
    </div>
  );
}
