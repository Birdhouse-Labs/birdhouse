// ABOUTME: Utilities for building canonical markdown references to Birdhouse model ids.
// ABOUTME: Keeps autocomplete insertion and markdown rendering aligned around birdhouse:model URLs.

export function buildModelMarkdownLink(modelId: string): string {
  return `[${modelId}](birdhouse:model/${modelId})`;
}
