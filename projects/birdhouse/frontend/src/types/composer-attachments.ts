// ABOUTME: Composer attachment types shared across new-agent and reply inputs.
// ABOUTME: Keeps pre-send attachment preview state aligned with harness attachment fields.

export interface ComposerAttachment {
  id: string;
  filename: string;
  mime: string;
  url: string;
}

export interface ComposerAttachmentPayload {
  type: "file";
  filename?: string;
  mime: string;
  url: string;
}

export type ComposerImageAttachment = ComposerAttachment;
export type ComposerImageAttachmentPayload = ComposerAttachmentPayload;
