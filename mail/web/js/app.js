// ============================================================
// PBG Mail — Main Application Controller
// Manages UI state, event binding, rendering, security & mobile controls
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
    appLayout:          $('#appLayout'),
    sidebar:            $('#sidebar'),
    sidebarBackdrop:    $('#sidebarBackdrop'),
    menuToggleBtn:      $('#menuToggleBtn'),
    emailList:          $('#emailList'),
    readingPane:        $('#readingPane'),
    readingEmpty:       $('#readingEmpty'),
    emailView:          $('#emailView'),
    mobileBackBtn:      $('#mobileBackBtn'),
    mobileComposeFab:   $('#mobileComposeFab'),
    folderList:         $('#folderList'),
    searchInput:        $('#searchInput'),
    pageInfo:           $('#pageInfo'),
    prevPage:           $('#prevPage'),
    nextPage:           $('#nextPage'),
    selectAll:          $('#selectAll'),
    composeOverlay:     $('#composeOverlay'),
    composeTo:          $('#composeTo'),
    composeCc:          $('#composeCc'),
    composeBcc:         $('#composeBcc'),
    composeSubject:     $('#composeSubject'),
    composeBody:        $('#composeBody'),
    composeTitle:       $('#composeTitle'),
    composeSendBtn:     $('#composeSendBtn'),
    composeAttachments: $('#composeAttachments'),
    composeFormatToolbar: $('#composeFormatToolbar'),
    contactSuggestions: $('#contactSuggestions'),
    userAvatar:         $('#userAvatar'),
    userDropdown:       $('#userDropdown'),
    dropdownName:       $('#dropdownName'),
    dropdownEmail:      $('#dropdownEmail'),
    adminBtn:           $('#adminBtn'),
    adminOverlay:       $('#adminOverlay'),
    adminClose:         $('#adminClose'),
    createAccountForm:  $('#createAccountForm'),
    refreshAccountsBtn: $('#refreshAccountsBtn'),
    shortcutsBtn:       $('#shortcutsBtn'),
    shortcutOverlay:    $('#shortcutOverlay'),
    shortcutClose:      $('#shortcutClose'),
    storageFill:        $('#storageFill'),
    storageText:        $('#storageText'),
    toastContainer:     $('#toastContainer'),
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
    if (acct.role === 'admin' && els.adminBtn) els.adminBtn.hidden = false;
  }

  // ── Event Binding ─────────────────────────────────────────
  function bindEvents() {
    // Folders
    els.folderList.addEventListener('click', (e) => {
      const item = e.target.closest('.folder-item');
      if (!item || item.getAttribute('role') === 'separator') return;
      switchFolder(item.dataset.folder);
      closeMobileSidebar();
    });

    // Mobile drawer toggle
    if (els.menuToggleBtn) {
      els.menuToggleBtn.addEventListener('click', toggleMobileSidebar);
    }
    if (els.sidebarBackdrop) {
      els.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
    }
    if (els.mobileBackBtn) {
      els.mobileBackBtn.addEventListener('click', showReadingEmpty);
    }
    if (els.mobileComposeFab) {
      els.mobileComposeFab.addEventListener('click', () => openCompose('new'));
    }

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

    // Rich Text Formatting Toolbar
    if (els.composeFormatToolbar) {
      els.composeFormatToolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.fmt-btn');
        if (!btn || btn.id === 'insertLinkBtn') return;
        const cmd = btn.dataset.cmd;
        const val = btn.dataset.val || null;
        if (cmd) {
          document.execCommand(cmd, false, val);
          els.composeBody.focus();
        }
      });

      const linkBtn = $('#insertLinkBtn');
      if (linkBtn) {
        linkBtn.addEventListener('click', () => {
          const url = prompt('Enter link URL (e.g. https://example.com):');
          if (url) {
            document.execCommand('createLink', false, url);
            els.composeBody.focus();
          }
        });
      }
    }

    // Contact Autocomplete in Compose
    let contactSearchTimeout;
    els.composeTo.addEventListener('input', (e) => {
      const val = e.target.value;
      const lastTerm = val.split(/[,;]/).pop().trim();
      clearTimeout(contactSearchTimeout);

      if (!els.contactSuggestions) return;
      if (lastTerm.length < 1) {
        els.contactSuggestions.hidden = true;
        return;
      }

      contactSearchTimeout = setTimeout(async () => {
        try {
          const res = await mailAPI.searchContacts(lastTerm);
          const contacts = res.contacts || [];
          if (contacts.length === 0) {
            els.contactSuggestions.hidden = true;
            return;
          }

          els.contactSuggestions.innerHTML = contacts.map(c => `
            <div class="autocomplete-item" data-address="${escapeHtml(c.address)}">
              <div>
                <strong>${escapeHtml(c.name || c.address.split('@')[0])}</strong>
                <div style="font-size:0.75rem;color:var(--text-muted)">&lt;${escapeHtml(c.address)}&gt;</div>
              </div>
              <span style="font-size:0.6875rem;color:var(--text-dim)">#${c.frequency}</span>
            </div>
          `).join('');
          els.contactSuggestions.hidden = false;

          els.contactSuggestions.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
              const chosen = item.dataset.address;
              const terms = val.split(/[,;]/).map(t => t.trim()).filter(Boolean);
              terms.pop();
              terms.push(chosen);
              els.composeTo.value = terms.join(', ') + ', ';
              els.contactSuggestions.hidden = true;
              els.composeTo.focus();
            });
          });
        } catch {}
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (els.contactSuggestions && !e.target.closest('#contactSuggestions') && e.target !== els.composeTo) {
        els.contactSuggestions.hidden = true;
      }
    });

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

    // Admin Console
    if (els.adminBtn) {
      els.adminBtn.addEventListener('click', () => {
        els.userDropdown.classList.remove('open');
        openAdmin();
      });
    }
    if (els.adminClose) {
      els.adminClose.addEventListener('click', closeAdmin);
    }
    if (els.createAccountForm) {
      els.createAccountForm.addEventListener('submit', handleCreateAccount);
    }
    if (els.refreshAccountsBtn) {
      els.refreshAccountsBtn.addEventListener('click', loadAdminAccounts);
    }

    // Keyboard Shortcuts Dialog
    if (els.shortcutsBtn) {
      els.shortcutsBtn.addEventListener('click', () => {
        els.userDropdown.classList.remove('open');
        if (els.shortcutOverlay) els.shortcutOverlay.hidden = false;
      });
    }
    if (els.shortcutClose) {
      els.shortcutClose.addEventListener('click', () => {
        if (els.shortcutOverlay) els.shortcutOverlay.hidden = true;
      });
    }

    // Logout
    $('#logoutBtn').addEventListener('click', async () => {
      await mailAPI.logoutRequest();
      mailAPI.logout();
      window.location.href = '/';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
  }

  // ── Mobile Drawer Helpers ─────────────────────────────────
  function toggleMobileSidebar() {
    if (!els.sidebar) return;
    const isOpen = els.sidebar.classList.contains('open');
    if (isOpen) closeMobileSidebar();
    else openMobileSidebar();
  }

  function openMobileSidebar() {
    if (els.sidebar) els.sidebar.classList.add('open');
    if (els.sidebarBackdrop) els.sidebarBackdrop.classList.add('active');
  }

  function closeMobileSidebar() {
    if (els.sidebar) els.sidebar.classList.remove('open');
    if (els.sidebarBackdrop) els.sidebarBackdrop.classList.remove('active');
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
      const data = await mailAPI.listEmails(state.currentFolder, state.currentPage);

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

      const updateBadge = (folder, count) => {
        const badge = $(`#badge-${folder}`);
        if (badge) badge.textContent = count > 0 ? count : '';
      };

      updateBadge('inbox', counts.inbox?.unread || 0);
      updateBadge('starred', counts.starred?.total || 0);
      updateBadge('sent', '');
      updateBadge('drafts', counts.drafts?.total || 0);
      updateBadge('spam', counts.spam?.total || 0);
      updateBadge('trash', counts.trash?.total || 0);

      // Storage quota update
      try {
        const me = await mailAPI.me();
        if (me && els.storageFill && els.storageText) {
          const used = me.storageUsed || 0;
          const max = 500 * 1024 * 1024;
          const pct = Math.min(100, Math.round((used / max) * 100));
          els.storageFill.style.width = `${pct}%`;
          els.storageText.textContent = `${formatBytes(used)} of 500 MB used`;
        }
      } catch {}

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

    els.emailList.querySelectorAll('.email-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });

    els.appLayout.classList.add('view-reading');

    try {
      els.readingEmpty.hidden = true;
      els.readingEmpty.style.display = 'none';
      els.emailView.hidden = false;
      els.emailView.style.display = 'flex';
      els.emailView.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%">
          <svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-400)" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10"/>
          </svg>
        </div>
      `;

      const data = await mailAPI.getEmail(id);
      state.activeEmail = data;

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

  // ── Secure Email Rendering (Isolated Sandbox Iframe) ──────
  function renderEmailView(data) {
    const email = data.email;
    const senderName = email.from?.name || email.from?.address?.split('@')[0] || 'Unknown';
    const senderInitial = senderName[0]?.toUpperCase() || '?';
    const toStr = (email.to || []).map(t => typeof t === 'string' ? t : `${t.name ? t.name + ' ' : ''}<${t.address}>`).join(', ');
    const ccStr = (email.cc || []).filter(c => c.address).map(c => `${c.name ? c.name + ' ' : ''}<${c.address}>`).join(', ');

    const hasHtml = !!email.htmlBody;
    const hasRemoteImages = hasHtml && /<img\s[^>]*src=["']?https?:\/\//i.test(email.htmlBody);

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

      ${hasRemoteImages ? `
        <div class="privacy-banner" id="privacyBanner">
          <span>🛡️ Remote tracking images are blocked to protect your privacy.</span>
          <button id="loadImagesBtn">Load Images</button>
        </div>
      ` : ''}

      <div class="email-view-body">
        <div class="email-body-content" id="emailBodyContainer"></div>
      </div>

      ${renderAttachments(data.attachments, email.id)}

      ${data.thread && data.thread.length > 1 ? renderThread(data.thread, email.id) : ''}
    `;

    els.emailView.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleEmailAction(btn.dataset.action, email));
    });

    const bodyContainer = $('#emailBodyContainer');

    if (hasHtml) {
      const iframe = document.createElement('iframe');
      iframe.className = 'email-body-iframe';
      iframe.setAttribute('sandbox', 'allow-popups');

      let currentHtml = email.htmlBody;
      let blockedHtml = currentHtml;

      if (hasRemoteImages) {
        blockedHtml = currentHtml.replace(/<img\s([^>]*src=["']?https?:\/\/[^"'>]+["']?)/gi, (m) => {
          return m.replace(/src=/i, 'data-blocked-src=');
        });
      }

      const buildDoc = (htmlStr) => `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <base target="_blank">
          <style>
            html, body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #f1f5f9;
              background: transparent;
              line-height: 1.6;
              margin: 0;
              padding: 4px 0;
              word-break: break-word;
            }
            a { color: #38bdf8; text-decoration: underline; }
            img { max-width: 100%; height: auto; border-radius: 4px; }
            pre, code { font-family: monospace; background: rgba(255,255,255,0.06); border-radius: 4px; }
            blockquote { border-left: 3px solid #64748b; margin: 8px 0; padding-left: 12px; color: #94a3b8; }
          </style>
        </head>
        <body>${htmlStr}</body>
        </html>
      `;

      iframe.srcdoc = buildDoc(hasRemoteImages ? blockedHtml : currentHtml);

      iframe.addEventListener('load', () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const resize = () => {
            const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
            iframe.style.height = `${h + 30}px`;
          };
          resize();
          setTimeout(resize, 300);
          setTimeout(resize, 1000);
        } catch {}
      });

      bodyContainer.appendChild(iframe);

      const loadImagesBtn = $('#loadImagesBtn');
      if (loadImagesBtn) {
        loadImagesBtn.addEventListener('click', () => {
          iframe.srcdoc = buildDoc(currentHtml);
          const banner = $('#privacyBanner');
          if (banner) banner.remove();
        });
      }

    } else if (email.textBody) {
      bodyContainer.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;color:var(--text-primary);line-height:1.6">${escapeHtml(email.textBody)}</pre>`;
    } else {
      bodyContainer.innerHTML = '<p style="color:var(--text-muted);font-style:italic">No content</p>';
    }
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
    els.readingEmpty.style.display = 'flex';
    els.emailView.hidden = true;
    els.emailView.style.display = 'none';
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
    loadFolderCounts();
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
      if (state.currentFolder === 'drafts') loadEmails();
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
    e.target.value = '';
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

  // ── Admin Console ─────────────────────────────────────────
  async function openAdmin() {
    if (els.adminOverlay) els.adminOverlay.hidden = false;
    loadAdminAccounts();
  }

  function closeAdmin() {
    if (els.adminOverlay) els.adminOverlay.hidden = true;
  }

  async function loadAdminAccounts() {
    const tbody = $('#accountsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Loading mailboxes…</td></tr>';

    try {
      const res = await mailAPI.listAccounts();
      const accounts = res.accounts || [];

      if (accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">No accounts found</td></tr>';
        return;
      }

      tbody.innerHTML = accounts.map(acct => `
        <tr>
          <td><strong>${escapeHtml(acct.address)}</strong></td>
          <td>${escapeHtml(acct.display_name || '—')}</td>
          <td><span class="badge-role ${acct.role}">${acct.role}</span></td>
          <td>${formatBytes(acct.storage_used || 0)}</td>
          <td>
            <span class="status-dot ${acct.is_active ? 'active' : 'inactive'}"></span>
            ${acct.is_active ? 'Active' : 'Disabled'}
          </td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn-secondary" data-toggle-active="${acct.id}" data-current="${acct.is_active}">
              ${acct.is_active ? 'Disable' : 'Enable'}
            </button>
            <button class="btn-secondary" data-reset-pw="${acct.id}" data-address="${escapeHtml(acct.address)}">
              Reset PW
            </button>
            ${acct.id !== mailAPI.account.id ? `
              <button class="btn-secondary" style="color:var(--rose-400)" data-delete-acct="${acct.id}" data-address="${escapeHtml(acct.address)}">
                Delete
              </button>
            ` : ''}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-toggle-active]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.toggleActive;
          const current = btn.dataset.current === '1' || btn.dataset.current === 'true';
          try {
            await mailAPI.updateAccount(id, { isActive: !current });
            toast(`Mailbox ${!current ? 'enabled' : 'disabled'}`, 'success');
            loadAdminAccounts();
          } catch (err) {
            toast(err.message, 'error');
          }
        });
      });

      tbody.querySelectorAll('[data-reset-pw]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.resetPw;
          const addr = btn.dataset.address;
          const newPass = prompt(`Enter new password for ${addr} (min 8 characters):`);
          if (!newPass) return;
          if (newPass.length < 8) {
            alert('Password must be at least 8 characters');
            return;
          }
          try {
            await mailAPI.updateAccount(id, { password: newPass });
            toast(`Password reset for ${addr}`, 'success');
          } catch (err) {
            toast(err.message, 'error');
          }
        });
      });

      tbody.querySelectorAll('[data-delete-acct]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.deleteAcct;
          const addr = btn.dataset.address;
          if (!confirm(`Are you sure you want to delete mailbox ${addr}?`)) return;
          try {
            await mailAPI.deleteAccount(id);
            toast(`Mailbox ${addr} deleted`, 'success');
            loadAdminAccounts();
          } catch (err) {
            toast(err.message, 'error');
          }
        });
      });

    } catch (err) {
      console.error('Failed to load accounts:', err);
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--rose-400);text-align:center;padding:20px">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    const btn = $('#createAccountBtn');
    const username = $('#newAccountUsername').value.trim();
    const displayName = $('#newAccountDisplayName').value.trim();
    const password = $('#newAccountPassword').value;
    const role = $('#newAccountRole').value;

    if (!username || !password || password.length < 8) {
      toast('Username and password (min 8 chars) required', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating…';

    try {
      await mailAPI.createAccount({
        address: `${username}@pbgofficials.dev`,
        displayName,
        password,
        role,
      });

      toast(`Created mailbox ${username}@pbgofficials.dev`, 'success');
      $('#createAccountForm').reset();
      loadAdminAccounts();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Mailbox';
    }
  }

  // ── Keyboard Shortcuts ────────────────────────────────────
  function handleKeyboard(e) {
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
      case '?':
        if (els.shortcutOverlay) els.shortcutOverlay.hidden = false;
        break;
      case 'Escape':
        if (els.composeOverlay.classList.contains('open')) closeCompose();
        else if (els.adminOverlay && !els.adminOverlay.hidden) closeAdmin();
        else if (els.shortcutOverlay && !els.shortcutOverlay.hidden) els.shortcutOverlay.hidden = true;
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
