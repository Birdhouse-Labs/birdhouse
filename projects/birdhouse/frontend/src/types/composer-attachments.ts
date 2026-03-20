// ABOUTME: Composer attachment types shared across new-agent and reply inputs.
// ABOUTME: Keeps pre-send image preview state aligned with OpenCode file-part fields.

export interface ComposerImageAttachment {
  id: string;
  filename: string;
  mime: string;
  url: string;
}

export interface ComposerImageAttachmentPayload {
  type: "file";
  filename?: string;
  mime: string;
  url: string;
}
