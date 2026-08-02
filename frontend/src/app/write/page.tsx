import type { Metadata } from "next";
import { TopBar } from "@/components/layout/TopBar";
import { WritingEditor } from "@/components/editor/WritingEditor";

export const metadata: Metadata = {
  title: "Write | WriteWise",
  description: "Draft and format your manuscript.",
};

export default function WritePage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar />

      <WritingEditor />
    </div>
  );
}
