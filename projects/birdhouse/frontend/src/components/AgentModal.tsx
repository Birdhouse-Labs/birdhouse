// ABOUTME: Minimal modal overlay for viewing agents in fullscreen dialog
// ABOUTME: Wraps LiveMessages with no additional chrome, ESC to close
// ABOUTME: Renders a single agent modal in a stack

import Dialog from "corvu/dialog";
import { type Component, type JSX, Show } from "solid-js";
import { ZIndexProvider } from "../contexts/ZIndexContext";
import LiveMessages from "./LiveMessages";

interface AgentModalProps {
  agentId: string;
  navigationDepth: number;
  isTop: boolean;
  onClose: () => void;
  onOpenAgentModal: (agentId: string) => void;
  children?: JSX.Element;
}

const AgentModal: Component<AgentModalProps> = (props) => {
  const depth = props.navigationDepth;

  // Calculate size reduction based on depth
  const sizeReduction = depth * 30; // 30px reduction per level

  // Calculate z-index for this modal level
  // Base is 50, increases by 10 for each depth level
  const baseZIndex = 50 + depth * 10;

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open && props.isTop) {
          props.onClose();
        }
      }}
      closeOnEscapeKeyDown={props.isTop}
      closeOnOutsidePointer={false}
      closeOnOutsideFocus={false}
    >
      <Dialog.Portal mount={document.body}>
        <Dialog.Overlay class="fixed inset-0 bg-black/20" style={{ "z-index": baseZIndex }} />

        {/* Active modal content - size decreases with depth */}
        <Dialog.Content
          class={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                   rounded-2xl bg-surface shadow-2xl
                   flex flex-col overflow-hidden`}
          style={{
            width: `calc(95vw - ${sizeReduction}px)`,
            height: `calc(95dvh - ${sizeReduction}px)`,
            "max-width": `calc(1792px - ${sizeReduction}px)`,
            "z-index": baseZIndex + 2,
          }}
          onKeyUp={(e: KeyboardEvent) => {
            if (e.code === "ShiftRight" && !e.metaKey && !e.ctrlKey && !e.altKey && props.isTop) {
              props.onClose();
            }
          }}
        >
          {/* Provide increased z-index context to children (dialogs, popovers) */}
          <ZIndexProvider baseZIndex={baseZIndex + 10}>
            <Show when={props.agentId} keyed>
              {(agentId) => (
                <LiveMessages
                  agentId={agentId}
                  initialFocusTarget="messages"
                  insideAgentModal={true}
                  onOpenAgentModal={props.onOpenAgentModal}
                  showCloseButton={props.navigationDepth >= 1 && props.isTop}
                  onClose={props.onClose}
                />
              )}
            </Show>
          </ZIndexProvider>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default AgentModal;
