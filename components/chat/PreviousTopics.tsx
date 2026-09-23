"use client";

import type { Message } from "@/lib/supabase/types";
import type { ArchivedTopicSection } from "@/lib/topics";
import { MessageList, type LikeState } from "./MessageList";

type ProfileLite = {
  id: string;
  nickname: string;
  role: "user" | "app_admin";
  name?: string;
};

/**
 * Collapsed record of prompts that are no longer the live chat.
 * Students and the chair can open each one. The summary shows that
 * prompt's theme.
 */
export function PreviousTopics({
  sections,
  profiles,
  meId,
  isNameVisible,
  likesEnabled,
  likes,
}: {
  sections: ArchivedTopicSection<Message>[];
  profiles: Record<string, ProfileLite>;
  meId: string;
  isNameVisible: boolean;
  likesEnabled: boolean;
  likes: Record<string, LikeState>;
}) {
  if (sections.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {sections.map((section) => (
        <details
          key={section.id}
          className="rounded-sm border border-navy-600/80 bg-navy-800/40"
        >
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-gold-500">
            前の議題: {section.theme}
            {section.messages.length > 0
              ? `（${section.messages.length}件）`
              : ""}
          </summary>
          <div className="border-t border-navy-600/80 p-3">
            {section.messages.length === 0 ? (
              <p className="text-sm text-muted">この議題の発言はありません。</p>
            ) : (
              <MessageList
                readOnly
                messages={section.messages}
                profiles={profiles}
                meId={meId}
                isAdmin={false}
                isNameVisible={isNameVisible}
                likesEnabled={likesEnabled}
                likes={likes}
                onToggleLike={() => {}}
                onToggleImportant={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
