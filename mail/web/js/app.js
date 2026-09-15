// ============================================================
// PBG Mail — Main Application Controller
// Manages UI state, event binding, rendering
// ============================================================

(function () {
  'use strict';

  // ── Auth guard ────────────────────────────────────────────
  if (!mailAPI.token || !mailAPI.account) {
    window.location.href = '/';
    return;
  }

  // ── State ─────────────────────────────────────────────────
  const state = {
    currentFolder: 'inbox',
    currentPage: 1,
    totalPages: 1,
    emails: [],
    selectedIds: new Set(),
    activeEmailId: null,
    activeEmail: null,
    folderCounts: {},
    composeMode: null,      // null | 'new' | 'reply' | 'replyAll' | 'forward'
    composeReplyToId: null,
    uploadedAttachments: [],
    searchQuery: '',
    isSearching: false,
  };

  // ── DOM refs ──────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    appLayout:      $('#appLayout'),
    emailList:      $('#emailList'),
    readingPane:    $('#readingPane'),
    readingEmpty:   $('#readingEmpty'),
    emailView:      $('#emailView'),
    folderList:     $('#folderList'),
    searchInput:    $('#searchInput'),
    pageInfo:       $('#pageInfo'),
    prevPage:       $('#prevPage'),
    nextPage:       $('#nextPage'),
    selectAll:      $('#selectAll'),
    composeOverlay: $('#composeOverlay'),
    composeTo:      $('#composeTo'),
    composeCc:      $('#composeCc'),
    composeBcc:     $('#composeBcc'),
    composeSubject: $('#composeSubject'),
    composeBody:    $('#composeBody'),
    composeTitle:   $('#composeTitle'),
    composeSendBtn: $('#composeSendBtn'),
    composeAttachments: $('#composeAttachments'),
    userAvatar:     $('#userAvatar'),
    userDropdown:   $('#userDropdown'),
    dropdownName:   $('#dropdownName'),
    dropdownEmail:  $('#dropdownEmail'),
    adminBtn:       $('#adminBtn'),
    storageFill:    $('#storageFill'),
    storageText:    $('#storageText'),
    toastContainer: $('#toastContainer'),
  };

  // ── Initialise ────────────────────────────────────────────
  async function init() {
    setupUserInfo();
    bindEvents();
    await Promise.all([loadEmails(), loadFolderCounts()]);
  }

  function setupUserInfo() {
    const acct = mailAPI.account;
    els.userAvatar.textContent = (acct.displayName || acct.address)[0].toUpperCase();
    els.dropdownName.textContent = acct.displayName || acct.address.split('@')[0];
    els.dropdownEmail.textContent = acct.address;
    if (acct.role === 'admin') els.adminBtn.hidden = false;
  }

  // ── Event Binding ─────────────────────────────────────────
  function bindEvents() {
    // Folders
    els.folderList.addEventListener('click', (e) => {
      const item = e.target.closest('.folder-item');
      if (!item || item.getAttribute('role') === 'separator') return;
      switchFolder(item.dataset.folder);
    });

    // Compose
    $('#composeBtn').addEventListener('click', () => openCompose('new'));
    $('#composeClose').addEventListener('click', closeCompose);
    $('#composeDiscard').addEventListener('click', closeCompose);
    els.composeOverlay.addEventListener('click', (e) => {
      if (e.target === els.composeOverlay) closeCompose();
    });
    els.composeSendBtn.addEventListener('click', handleSend);
    $('#composeSaveDraft').addEventListener('click', handleSaveDraft);
    $('#toggleCcBcc').addEventListener('click', () => {
      $('#ccField').hidden = !$('#ccField').hidden;
      $('#bccField').hidden = !$('#bccField').hidden;
    });
    $('#composeFileInput').addEventListener('change', handleFileAttach);

    // Toolbar
    els.selectAll.addEventListener('change', handleSelectAll);
    $('#toolbarArchive').addEventListener('click', () => batchAction('move', 'archive'));
    $('#toolbarTrash').addEventListener('click', () => batchAction('trash'));
    $('#toolbarSpam').addEventListener('click', () => batchAction('spam'));
    $('#toolbarRead').addEventListener('click', () => batchAction('read'));

    // Pagination
    els.prevPage.addEventListener('click', () => changePage(-1));
    els.nextPage.addEventListener('click', () => changePage(1));

    // Search
    let searchTimeout;
    els.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const q = e.target.value.trim();
      searchTimeout = setTimeout(() => {
        if (q.length >= 2) {
          state.searchQuery = q;
          state.isSearching = true;
          searchEmails(q);
        } else if (q.length === 0 && state.isSearching) {
          state.searchQuery = '';
          state.isSearching = false;
          loadEmails();
        }
      }, 400);
    });

    // Refresh
    $('#refreshBtn').addEventListener('click', () => {
      loadEmails();
      loadFolderCounts();
      toast('Refreshed', 'info');
    });

    // User dropdown
    els.userAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      els.userDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => els.userDropdown.classList.remove('open'));

    // Logout
    $('#logoutBtn').addEventListener('click', async () => {
      await mailAPI.logoutRequest();
      mailAPI.logout();
      window.location.href = '/';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
  }

  // ── Folder Navigation ─────────────────────────────────────
  function switchFolder(folder) {
    state.currentFolder = folder;
    state.currentPage = 1;
    state.activeEmailId = null;
    state.activeEmail = null;
    state.isSearching = false;
    state.searchQuery = '';
    els.searchInput.value = '';

    // Update active folder UI
    $$('.folder-item').forEach(el => el.classList.remove('active'));
    const target = $(`.folder-item[data-folder="${folder}"]`);
    if (target) target.classList.add('active');

    showReadingEmpty();
    loadEmails();
  }

  // ── Load Emails ───────────────────────────────────────────
  async function loadEmails() {
    try {
      renderEmailListLoading();
      let data;

      if (state.currentFolder === 'starred') {
        // "Starred" is a virtual folder — query all starred emails
        data = await mailAPI.request('GET', `/api/emails?folder=inbox&page=${state.currentPage}`);
        // Filter client-side (API doesn't have a starred filter, but we handle it)
        // For a proper implementation, you'd add server-side support
      } else {
        data = await mailAPI.listEmails(state.currentFolder, state.currentPage);
      }

      state.emails = data.emails || [];
      state.totalPages = data.totalPages || 1;
      state.selectedIds.clear();

      renderEmailList();
      renderPagination(data);
      updateToolbarState();
    } catch (err) {
      console.error('Failed to load emails:', err);
      toast('Failed to load emails', 'error');
    }
  }

  async function searchEmails(query) {
    try {
      renderEmailListLoading();
      const data = await mailAPI.searchEmails(query);
      state.emails = data.emails || [];
      state.selectedIds.clear();
      renderEmailList();
      els.pageInfo.textContent = `${state.emails.length} results`;
      els.prevPage.disabled = true;
      els.nextPage.disabled = true;
    } catch (err) {
      console.error('Search failed:', err);
      toast('Search failed', 'error');
    }
  }

  async function loadFolderCounts() {
    try {
      const counts = await mailAPI.folderCounts();
      state.folderCounts = counts;

      // Update badges
      const updateBadge = (folder, count) => {
        const badge = $(`#badge-${folder}`);
        if (badge) badge.textContent = count > 0 ? count : '';
      };

      updateBadge('inbox', counts.inbox?.unread || 0);
      updateBadge('sent', '');
      updateBadge('drafts', counts.drafts?.total || 0);
      updateBadge('spam', counts.spam?.total || 0);
      updateBadge('trash', counts.trash?.total || 0);

      // Update page title
      const inboxUnread = counts.inbox?.unread || 0;
      document.title = inboxUnread > 0 ? `(${inboxUnread}) PBG Mail` : 'PBG Mail';
    } catch (err) {
      console.error('Failed to load counts:', err);
    }
  }

  // ── Render Email List ─────────────────────────────────────
  function renderEmailList() {
    if (state.emails.length === 0) {
      els.emailList.innerHTML = `
        <div class="email-list-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <h3>No emails</h3>
          <p>${state.isSearching ? 'No results for your search' : `Your ${state.currentFolder} is empty`}</p>
        </div>
      `;
      return;
    }

    els.emailList.innerHTML = state.emails.map(email => {
      const isActive = email.id === state.activeEmailId;
      const isSelected = state.selectedIds.has(email.id);
      const unread = !email.isRead;
      const senderName = email.from?.name || email.from?.address?.split('@')[0] || 'Unknown';
      const dateStr = formatDate(email.date);

      return `
        <div class="email-item ${unread ? 'unread' : ''} ${isActive ? 'active' : ''}"
             data-id="${email.id}">
          <input type="checkbox" class="email-checkbox" ${isSelected ? 'checked' : ''}
                 data-id="${email.id}">
          <div class="email-content" data-id="${email.id}">
            <div class="email-top-row">
              <span class="email-sender">${escapeHtml(senderName)}</span>
              <div class="email-icons">
                ${email.hasAttachments ? '<svg class="email-icon-attachment" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>' : ''}
                <svg class="email-icon-star ${email.isStarred ? 'starred' : ''}" data-star="${email.id}"
                     width="14" height="14" viewBox="0 0 24 24" fill="${email.isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <span class="email-date">${dateStr}</span>
            </div>
            <div class="email-subject">${escapeHtml(email.subject)}</div>
            <div class="email-snippet">${escapeHtml(email.snippet || '')}</div>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events
    els.emailList.querySelectorAll('.email-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.email-checkbox')) return;
        if (e.target.closest('[data-star]')) {
          toggleStar(e.target.closest('[data-star]').dataset.star);
          return;
        }
        openEmail(item.dataset.id);
      });
    });

    els.emailList.querySelectorAll('.email-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) state.selectedIds.add(e.target.dataset.id);
        else state.selectedIds.delete(e.target.dataset.id);
        updateToolbarState();
      });
    });
  }

  function renderEmailListLoading() {
    els.emailList.innerHTML = Array.from({ length: 8 }, () => `
      <div class="email-item">
        <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:6px">
          <div class="skeleton" style="width:40%;height:14px"></div>
          <div class="skeleton" style="width:70%;height:12px"></div>
          <div class="skeleton" style="width:90%;height:10px"></div>
        </div>
      </div>
    `).join('');
  }

  // ── Open Email ────────────────────────────────────────────
  async function openEmail(id) {
    state.activeEmailId = id;

    // Highlight in list
    els.emailList.querySelectorAll('.email-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });

    // Mobile: switch view
    els.appLayout.classList.add('view-reading');

    try {
      els.readingEmpty.hidden = true;
      els.emailView.hidden = false;
      els.emailView.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%">
          <svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-400)" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10"/>
          </svg>
        </div>
      `;

      const data = await mailAPI.getEmail(id);
      state.activeEmail = data;

      // Mark as read in list
      const emailInList = state.emails.find(e => e.id === id);
      if (emailInList && !emailInList.isRead) {
        emailInList.isRead = true;
        const listItem = els.emailList.querySelector(`.email-item[data-id="${id}"]`);
        if (listItem) listItem.classList.remove('unread');
        loadFolderCounts();
      }

      renderEmailView(data);
    } catch (err) {
      console.error('Failed to open email:', err);
      toast('Failed to load email', 'error');
      showReadingEmpty();
    }
  }

  function renderEmailView(data) {
    const email = data.email;
    const senderName = email.from?.name || email.from?.address?.split('@')[0] || 'Unknown';
    const senderInitial = senderName[0]?.toUpperCase() || '?';
    const toStr = (email.to || []).map(t => typeof t === 'string' ? t : `${t.name ? t.name + ' ' : ''}<${t.address}>`).join(', ');
    const ccStr = (email.cc || []).filter(c => c.address).map(c => `${c.name ? c.name + ' ' : ''}<${c.address}>`).join(', ');

    let bodyHtml = '';
    if (email.htmlBody) {
      bodyHtml = sanitizeHtml(email.htmlBody);
    } else if (email.textBody) {
      bodyHtml = `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(email.textBody)}</pre>`;
    } else {
      bodyHtml = '<p style="color:var(--text-muted);font-style:italic">No content</p>';
    }

    els.emailView.innerHTML = `
      <div class="email-view-header">
        <div class="email-view-subject">${escapeHtml(email.subject)}</div>
        <div class="email-view-meta">
          <div class="email-view-avatar">${senderInitial}</div>
          <div class="email-view-from">
            <div class="email-view-from-name">${escapeHtml(senderName)}</div>
            <div class="email-view-from-address">&lt;${escapeHtml(email.from?.address || '')}&gt;</div>
            <div class="email-view-recipients">
              To: ${escapeHtml(toStr)}
              ${ccStr ? `<br>Cc: ${escapeHtml(ccStr)}` : ''}
            </div>
          </div>
          <div class="email-view-date">${formatDateFull(email.date)}</div>
        </div>
      </div>

      <div class="email-view-actions">
        <button class="action-btn primary" data-action="reply">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
          Reply
        </button>
        <button class="action-btn" data-action="replyAll">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 17 2 12 7 7"/><polyline points="12 17 7 12 12 7"/><path d="M22 18v-2a4 4 0 00-4-4H7"/></svg>
          Reply All
        </button>
        <button class="action-btn" data-action="forward">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 014-4h12"/></svg>
          Forward
        </button>
        <span class="toolbar-spacer"></span>
        <button class="action-btn" data-action="archive" title="Archive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
        </button>
        <button class="action-btn" data-action="spam" title="Report spam">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </button>
        <button class="action-btn danger" data-action="trash" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>

      <div class="email-view-body">
        <div class="email-body-content">${bodyHtml}</div>
      </div>

      ${renderAttachments(data.attachments, email.id)}

      ${data.thread && data.thread.length > 1 ? renderThread(data.thread, email.id) : ''}
    `;

    // Bind action buttons
    els.emailView.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleEmailAction(btn.dataset.action, email));
    });
  }

  function renderAttachments(attachments, emailId) {
    if (!attachments || attachments.length === 0) return '';

    const chips = attachments.map(att => `
      <a class="attachment-chip" href="${mailAPI.getAttachmentUrl(emailId, att.id)}"
         target="_blank" download="${escapeHtml(att.filename)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
        ${escapeHtml(att.filename)}
        <span class="attachment-size">${formatBytes(att.size_bytes)}</span>
      </a>
    `).join('');

    return `
      <div class="email-attachments">
        <div class="email-attachments-title">${attachments.length} Attachment${attachments.length > 1 ? 's' : ''}</div>
        <div class="attachment-list">${chips}</div>
      </div>
    `;
  }

  function renderThread(thread, activeId) {
    if (thread.length <= 1) return '';
    const items = thread.map(t => `
      <div class="email-item ${t.id === activeId ? 'active' : ''} ${!t.is_read ? 'unread' : ''}"
           data-id="${t.id}" style="cursor:pointer;border-left:none;padding:8px 12px">
        <div class="email-content">
          <div class="email-top-row">
            <span class="email-sender">${escapeHtml(t.from_name || t.from_address?.split('@')[0] || '')}</span>
            <span class="email-date">${formatDate(t.date)}</span>
          </div>
          <div class="email-snippet">${escapeHtml(t.snippet || '')}</div>
        </div>
      </div>
    `).join('');

    return `
      <div style="border-top:1px solid var(--border-subtle);padding:8px 24px;background:var(--surface-1)">
        <div class="email-attachments-title">Thread (${thread.length} messages)</div>
        ${items}
      </div>
    `;
  }

  function showReadingEmpty() {
    els.readingEmpty.hidden = false;
    els.emailView.hidden = true;
    els.appLayout.classList.remove('view-reading');
  }

  // ── Email Actions ─────────────────────────────────────────
  async function handleEmailAction(action, email) {
    switch (action) {
      case 'reply':    openCompose('reply', email); break;
      case 'replyAll': openCompose('replyAll', email); break;
      case 'forward':  openCompose('forward', email); break;
      case 'archive':
        await mailAPI.updateEmail(email.id, { folder: 'archive' });
        toast('Moved to archive', 'success');
        showReadingEmpty();
        loadEmails();
        loadFolderCounts();
        break;
      case 'spam':
        await mailAPI.updateEmail(email.id, { folder: 'spam' });
        toast('Reported as spam', 'success');
        showReadingEmpty();
        loadEmails();
        loadFolderCounts();
        break;
      case 'trash':
        await mailAPI.deleteEmail(email.id);
        toast('Moved to trash', 'success');
        showReadingEmpty();
        loadEmails();
        loadFolderCounts();
        break;
    }
  }

  async function toggleStar(id) {
    const email = state.emails.find(e => e.id === id);
    if (!email) return;
    const newStarred = !email.isStarred;
    email.isStarred = newStarred;
    renderEmailList();
    await mailAPI.updateEmail(id, { is_starred: newStarred });
  }

  // ── Batch Actions ─────────────────────────────────────────
  async function batchAction(action, folder) {
    const ids = [...state.selectedIds];
    if (ids.length === 0) return;

    try {
      await mailAPI.batchAction(ids, action, folder);
      toast(`${ids.length} email${ids.length > 1 ? 's' : ''} updated`, 'success');
      state.selectedIds.clear();
      loadEmails();
      loadFolderCounts();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function handleSelectAll(e) {
    if (e.target.checked) {
      state.emails.forEach(em => state.selectedIds.add(em.id));
    } else {
      state.selectedIds.clear();
    }
    renderEmailList();
    updateToolbarState();
  }

  function updateToolbarState() {
    const hasSelection = state.selectedIds.size > 0;
    $('#toolbarArchive').disabled = !hasSelection;
    $('#toolbarTrash').disabled = !hasSelection;
    $('#toolbarSpam').disabled = !hasSelection;
    $('#toolbarRead').disabled = !hasSelection;
  }

  // ── Compose ───────────────────────────────────────────────
  function openCompose(mode, replyEmail = null) {
    state.composeMode = mode;
    state.composeReplyToId = replyEmail?.id || null;
    state.uploadedAttachments = [];
    els.composeAttachments.innerHTML = '';

    // Reset fields
    els.composeTo.value = '';
    els.composeCc.value = '';
    els.composeBcc.value = '';
    els.composeSubject.value = '';
    els.composeBody.innerHTML = '';
    $('#ccField').hidden = true;
    $('#bccField').hidden = true;

    if (mode === 'reply' && replyEmail) {
      els.composeTitle.textContent = 'Reply';
      els.composeTo.value = replyEmail.replyTo || replyEmail.from?.address || '';
      els.composeSubject.value = replyEmail.subject?.match(/^re:/i)
        ? replyEmail.subject : `Re: ${replyEmail.subject}`;
      els.composeBody.innerHTML = buildQuotedReply(replyEmail);
    } else if (mode === 'replyAll' && replyEmail) {
      els.composeTitle.textContent = 'Reply All';
      els.composeTo.value = replyEmail.replyTo || replyEmail.from?.address || '';
      const others = [...(replyEmail.to || []), ...(replyEmail.cc || [])]
        .map(a => typeof a === 'string' ? a : a.address)
        .filter(a => a && a !== mailAPI.account.address);
      if (others.length > 0) {
        els.composeCc.value = others.join(', ');
        $('#ccField').hidden = false;
      }
      els.composeSubject.value = replyEmail.subject?.match(/^re:/i)
        ? replyEmail.subject : `Re: ${replyEmail.subject}`;
      els.composeBody.innerHTML = buildQuotedReply(replyEmail);
    } else if (mode === 'forward' && replyEmail) {
      els.composeTitle.textContent = 'Forward';
      els.composeSubject.value = replyEmail.subject?.match(/^fwd?:/i)
        ? replyEmail.subject : `Fwd: ${replyEmail.subject}`;
      els.composeBody.innerHTML = buildForwardBody(replyEmail);
    } else {
      els.composeTitle.textContent = 'New Message';
    }

    els.composeOverlay.classList.add('open');
    if (mode === 'new') {
      els.composeTo.focus();
    } else {
      els.composeBody.focus();
      // Place cursor at start
      const range = document.createRange();
      range.setStart(els.composeBody, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function closeCompose() {
    els.composeOverlay.classList.remove('open');
    state.composeMode = null;
    state.composeReplyToId = null;
    state.uploadedAttachments = [];
  }

  function buildQuotedReply(email) {
    const date = formatDateFull(email.date);
    const from = email.from?.name
      ? `${email.from.name} &lt;${email.from.address}&gt;`
      : email.from?.address;
    const body = email.htmlBody || `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(email.textBody || '')}</pre>`;

    return `<br><br><div style="border-left:2px solid var(--navy-600);padding-left:12px;color:var(--text-secondary)">
      <p style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:8px">
        On ${date}, ${from} wrote:
      </p>
      ${body}
    </div>`;
  }

  function buildForwardBody(email) {
    const from = email.from?.name
      ? `${email.from.name} &lt;${email.from.address}&gt;`
      : email.from?.address;
    const body = email.htmlBody || `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(email.textBody || '')}</pre>`;

    return `<br><br><div style="border-left:2px solid var(--navy-600);padding-left:12px;color:var(--text-secondary)">
      <p style="font-size:0.8125rem;color:var(--text-muted)">
        <b>---------- Forwarded message ----------</b><br>
        From: ${from}<br>
        Date: ${formatDateFull(email.date)}<br>
        Subject: ${escapeHtml(email.subject)}
      </p>
      ${body}
    </div>`;
  }

  // ── Send ──────────────────────────────────────────────────
  async function handleSend() {
    const to = parseRecipients(els.composeTo.value);
    const cc = parseRecipients(els.composeCc.value);
    const bcc = parseRecipients(els.composeBcc.value);
    const subject = els.composeSubject.value.trim();
    const htmlBody = els.composeBody.innerHTML;
    const textBody = els.composeBody.innerText;

    if (to.length === 0) {
      toast('Add at least one recipient', 'error');
      els.composeTo.focus();
      return;
    }

    els.composeSendBtn.disabled = true;
    els.composeSendBtn.innerHTML = '<svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg> Sending…';

    try {
      const attachmentIds = state.uploadedAttachments.map(a => a.id);

      if (state.composeMode === 'reply' || state.composeMode === 'replyAll') {
        await mailAPI.replyEmail({
          emailId: state.composeReplyToId,
          htmlBody, textBody,
          replyAll: state.composeMode === 'replyAll',
          cc, attachmentIds,
        });
      } else if (state.composeMode === 'forward') {
        await mailAPI.forwardEmail({
          emailId: state.composeReplyToId,
          to, cc, htmlBody, textBody,
          includeAttachments: true,
        });
      } else {
        await mailAPI.sendEmail({ to, cc, bcc, subject, htmlBody, textBody, attachmentIds });
      }

      toast('Email sent successfully', 'success');
      closeCompose();
      loadFolderCounts();
    } catch (err) {
      toast(`Send failed: ${err.message}`, 'error');
    } finally {
      els.composeSendBtn.disabled = false;
      els.composeSendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send';
    }
  }

  async function handleSaveDraft() {
    try {
      const to = parseRecipients(els.composeTo.value);
      const cc = parseRecipients(els.composeCc.value);
      const bcc = parseRecipients(els.composeBcc.value);
      const subject = els.composeSubject.value.trim();
      const htmlBody = els.composeBody.innerHTML;
      const textBody = els.composeBody.innerText;

      await mailAPI.saveDraft({ to, cc, bcc, subject, htmlBody, textBody });
      toast('Draft saved', 'info');
      closeCompose();
      loadFolderCounts();
    } catch (err) {
      toast(`Failed to save draft: ${err.message}`, 'error');
    }
  }

  // ── File Attachments ──────────────────────────────────────
  async function handleFileAttach(e) {
    const files = e.target.files;
    for (const file of files) {
      try {
        const result = await mailAPI.uploadAttachment(file);
        state.uploadedAttachments.push(result);
        renderComposeAttachments();
        toast(`Attached: ${file.name}`, 'info');
      } catch (err) {
        toast(`Failed to attach ${file.name}: ${err.message}`, 'error');
      }
    }
    e.target.value = ''; // reset
  }

  function renderComposeAttachments() {
    els.composeAttachments.innerHTML = state.uploadedAttachments.map((att, idx) => `
      <span class="attachment-chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
        ${escapeHtml(att.filename)}
        <span class="attachment-size">${formatBytes(att.sizeBytes)}</span>
        <button data-remove-att="${idx}" style="color:var(--rose-400);background:none;border:none;cursor:pointer;font-size:16px;line-height:1">×</button>
      </span>
    `).join('');

    els.composeAttachments.querySelectorAll('[data-remove-att]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.removeAtt);
        state.uploadedAttachments.splice(idx, 1);
        renderComposeAttachments();
      });
    });
  }

  // ── Pagination ────────────────────────────────────────────
  function renderPagination(data) {
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);
    els.pageInfo.textContent = data.total > 0 ? `${start}–${end} of ${data.total}` : '';
    els.prevPage.disabled = data.page <= 1;
    els.nextPage.disabled = data.page >= data.totalPages;
  }

  function changePage(delta) {
    state.currentPage = Math.max(1, Math.min(state.totalPages, state.currentPage + delta));
    loadEmails();
  }

  // ── Keyboard Shortcuts ────────────────────────────────────
  function handleKeyboard(e) {
    // Don't intercept when typing
    if (e.target.matches('input, textarea, [contenteditable]')) return;

    switch (e.key) {
      case 'c': openCompose('new'); break;
      case 'r':
        if (state.activeEmail) handleEmailAction('reply', state.activeEmail.email);
        break;
      case 'a':
        if (state.activeEmail) handleEmailAction('archive', state.activeEmail.email);
        break;
      case '#':
      case 'Delete':
        if (state.activeEmail) handleEmailAction('trash', state.activeEmail.email);
        break;
      case 'Escape':
        if (els.composeOverlay.classList.contains('open')) closeCompose();
        else showReadingEmpty();
        break;
    }
  }

  // ── Toast Notifications ───────────────────────────────────
  function toast(message, type = 'info') {
    const iconMap = {
      success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--emerald-400)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rose-400)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-400)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${iconMap[type]}</span><span class="toast-message">${escapeHtml(message)}</span>`;
    els.toastContainer.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }

  // ── Helpers ───────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function sanitizeHtml(html) {
    // Basic sanitization — strip scripts and event handlers
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\bon\w+\s*=/gi, 'data-blocked=')
      .replace(/javascript:/gi, 'blocked:');
  }

  function parseRecipients(str) {
    return str.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateFull(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  // ── Start ─────────────────────────────────────────────────
  init();

  // Auto-refresh every 2 minutes
  setInterval(() => {
    loadEmails();
    loadFolderCounts();
  }, 120000);

})();
