import { ProgressBar } from "@/components/ui/ProgressBar";
import type { WritingProfile } from "@/features/task-definition/types";

interface WritingProfileCardProps {
  profile: WritingProfile;
}

export function WritingProfileCard({ profile }: WritingProfileCardProps) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-brand p-6 text-brand-foreground">
      <h2 className="font-semibold">Personalized Writing Profile</h2>
      <ProgressBar label="Vocabulary" value={profile.vocabulary} />
      <ProgressBar label="Mechanics" value={profile.mechanics} />
      <ProgressBar label="Organization" value={profile.organization} />
    </div>
  );
}
