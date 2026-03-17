// ABOUTME: Nested modal wrapper for the shared skill detail content.
// ABOUTME: Preserves modal presentation for any flows that still need an overlay detail view.

import Dialog from "corvu/dialog";
import { X } from "lucide-solid";
import type { Component } from "solid-js";
import type { SkillDetail } from "../types/skill-library-types";
import SkillDetailContent from "./SkillDetailContent";

export interface SkillDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: SkillDetail;
  workspaceId: string;
  onUpdateTriggerPhrases: (phrases: string[]) => Promise<void>;
}

const SkillDetailModal: Component<SkillDetailModalProps> = (props) => {
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      closeOnOutsidePointer={false}
      closeOnOutsideFocus={false}
      preventScroll={false}
      restoreScrollPosition={false}
    >
      <Dialog.Portal mount={document.body}>
        <Dialog.Overlay class="fixed inset-0 bg-black/20" style={{ "z-index": "115" }} />
        <Dialog.Content
          class="fixed rounded-2xl shadow-2xl w-[90vw] h-[90dvh] max-w-[1200px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden bg-surface"
          style={{ "z-index": "117" }}
        >
          <div class="px-6 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
            <Dialog.Label class="text-lg font-semibold text-heading">{props.skill.title}</Dialog.Label>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <SkillDetailContent
            skill={props.skill}
            workspaceId={props.workspaceId}
            onUpdateTriggerPhrases={props.onUpdateTriggerPhrases}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default SkillDetailModal;
