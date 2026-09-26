// ============================================================
// PBG Mail — API Client
// Wraps all fetch calls to the Worker REST API
// ============================================================

const API_BASE = ''; // Same origin

class MailAPI {
  constructor() {
    this.token = localStorage.getItem('pbg_mail_token');
    this.account = JSON.parse(localStorage.getItem('pbg_mail_account') || 'null');
  }

  get headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async request(method, path, body = null) {
    const opts = { method, headers: this.headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);

    if (res.status === 401) {
      this.logout();
      window.location.href = '/';
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error || data.details?.message || (typeof data.details === 'string' ? data.details : null) || `Request failed (${res.status})`;
      throw new Error(errMsg);
    }
    return data;
  }

  // ── Auth ──────────────────────────────────────────────────

  async login(address, password) {
    const data = await this.request('POST', '/api/auth/login', { address, password });
    this.token = data.token;
    this.account = data.account;
    localStorage.setItem('pbg_mail_token', data.token);
    localStorage.setItem('pbg_mail_account', JSON.stringify(data.account));
    return data;
  }

  async me() {
    return this.request('GET', '/api/auth/me');
  }

  async logoutRequest() {
    try { await this.request('POST', '/api/auth/logout'); } catch {}
  }

  logout() {
    this.token = null;
    this.account = null;
    localStorage.removeItem('pbg_mail_token');
    localStorage.removeItem('pbg_mail_account');
  }

  // ── Emails ────────────────────────────────────────────────

  async listEmails(folder = 'inbox', page = 1) {
    return this.request('GET', `/api/emails?folder=${encodeURIComponent(folder)}&page=${page}`);
  }

  async getEmail(id) {
    return this.request('GET', `/api/emails/${id}`);
  }

  async updateEmail(id, updates) {
    return this.request('PATCH', `/api/emails/${id}`, updates);
  }

  async deleteEmail(id, permanent = false) {
    return this.request('DELETE', `/api/emails/${id}?permanent=${permanent}`);
  }

  async batchAction(ids, action, folder) {
    return this.request('POST', '/api/emails/batch', { ids, action, folder });
  }

  async searchEmails(query, folder) {
    let path = `/api/emails/search?q=${encodeURIComponent(query)}`;
    if (folder) path += `&folder=${encodeURIComponent(folder)}`;
    return this.request('GET', path);
  }

  async folderCounts() {
    return this.request('GET', '/api/emails/counts');
  }

  // ── Compose ───────────────────────────────────────────────

  async sendEmail(data) {
    return this.request('POST', '/api/compose/send', data);
  }

  async replyEmail(data) {
    return this.request('POST', '/api/compose/reply', data);
  }

  async forwardEmail(data) {
    return this.request('POST', '/api/compose/forward', data);
  }

  async saveDraft(data) {
    return this.request('POST', '/api/drafts', data);
  }

  async updateDraft(id, data) {
    return this.request('PUT', `/api/drafts/${id}`, data);
  }

  async deleteDraft(id) {
    return this.request('DELETE', `/api/drafts/${id}`);
  }

  // ── Attachments ───────────────────────────────────────────

  async uploadAttachment(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/api/attachments/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  getAttachmentUrl(emailId, attachmentId) {
    return `${API_BASE}/api/emails/${emailId}/attachments/${attachmentId}`;
  }

  // ── Contacts ──────────────────────────────────────────────

  async searchContacts(query) {
    return this.request('GET', `/api/contacts?q=${encodeURIComponent(query)}`);
  }

  // ── Accounts (Admin) ─────────────────────────────────────

  async listAccounts() {
    return this.request('GET', '/api/accounts');
  }

  async createAccount(data) {
    return this.request('POST', '/api/accounts', data);
  }

  async updateAccount(id, data) {
    return this.request('PATCH', `/api/accounts/${id}`, data);
  }

  async deleteAccount(id) {
    return this.request('DELETE', `/api/accounts/${id}`);
  }
}

window.mailAPI = new MailAPI();
