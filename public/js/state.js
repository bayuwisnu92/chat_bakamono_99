let activeConversationId = null;

export function setActiveConversation(id) {
  activeConversationId = id;
}

export function getActiveConversation() {
  return activeConversationId;
}