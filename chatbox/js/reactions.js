/* ============================================
   PBG ChatBox — Message Reactions Module
   ============================================ */

window.ChatReactions = (() => {
  function renderReactionsHtml(reactions, msgId, currentUser, escapeHtml) {
    if (!reactions || typeof reactions !== 'object') return '';
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str).replace(/[&<>"']/g, ''));
    return Object.entries(reactions).map(([emoji, users]) => {
      if (!Array.isArray(users) || users.length === 0) return '';
      const hasMe = currentUser && users.includes(currentUser);
      return `
        <button class="msg-reaction-pill${hasMe ? ' active' : ''}" data-msg-id="${msgId}" data-emoji="${emoji}" title="${esc(users.join(', '))}">
          <span class="mrp-emoji">${emoji}</span>
          <span class="mrp-count">${users.length}</span>
        </button>
      `;
    }).join('');
  }

  function handleReactionClick(target, socket) {
    const reactionBtn = target.closest('.msg-reaction-btn, .msg-reaction-pill');
    if (reactionBtn) {
      const msgId = reactionBtn.dataset.msgId;
      const emoji = reactionBtn.dataset.emoji;
      if (msgId && emoji && socket) {
        socket.emit('message-react', { messageId, emoji });
      }
      return true;
    }
    return false;
  }

  return { renderReactionsHtml, handleReactionClick };
})();
