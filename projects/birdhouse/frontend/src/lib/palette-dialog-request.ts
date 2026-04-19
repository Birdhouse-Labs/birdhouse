// ABOUTME: Resolves which modal layer should render a command palette agent subdialog.
// ABOUTME: Gives ownership to the top-most matching agent layer in a modal stack.

interface ModalStackEntry {
  id: string;
}

interface AgentScopedRequest {
  agentId: string;
}

export function getPaletteDialogRequestForLayer<T extends AgentScopedRequest>(
  stack: readonly ModalStackEntry[],
  index: number,
  request: T | null,
): T | null {
  const currentModal = stack[index];

  if (!currentModal || !request || request.agentId !== currentModal.id) {
    return null;
  }

  for (let candidateIndex = stack.length - 1; candidateIndex > index; candidateIndex -= 1) {
    if (stack[candidateIndex]?.id === request.agentId) {
      return null;
    }
  }

  return request;
}
