// ABOUTME: Inline model reference button with a Corvu popover for canonical ids.
// ABOUTME: Shows the display name in prose and reveals the exact provider/model id on demand.

import Popover from "corvu/popover";
import { type Component, createSignal } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import CopyButton from "./CopyButton";

export interface ModelReferenceButtonProps {
  label: string;
  modelId: string;
}

export const ModelReferenceButton: Component<ModelReferenceButtonProps> = (props) => {
  const baseZIndex = useZIndex();
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <Popover open={isOpen()} onOpenChange={setIsOpen} floatingOptions={{ offset: 8, flip: true, shift: true }}>
      <Popover.Trigger
        as="button"
        type="button"
        class="model-ref inline-flex items-center rounded font-semibold cursor-pointer"
      >
        {props.label}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content class="max-w-[80vw] md:max-w-sm" style={{ "z-index": baseZIndex }}>
          <div class="bg-surface-raised p-3 rounded-lg border shadow-lg border-border">
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs font-medium uppercase tracking-wide text-text-secondary">Model ID</div>
              <CopyButton text={props.modelId} />
            </div>
            <div class="mt-2 rounded bg-surface px-2 py-1.5 font-mono text-sm text-text-primary break-all">
              {props.modelId}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

export default ModelReferenceButton;
