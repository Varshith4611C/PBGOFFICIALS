/**
 * frAIday — Safety Policy & Human-in-the-Loop Interceptor
 */

export class SafetyPolicyManager {
  constructor(alertContainer) {
    this.alertContainer = alertContainer;
    this.currentPolicy = 'request_review'; // 'request_review', 'autonomous', 'strict_sandbox'
    this.pendingApproval = null;
  }

  setPolicy(policy) {
    this.currentPolicy = policy;
  }

  /**
   * Request approval for a potentially dangerous operation
   * Returns a promise that resolves true (approved) or false (rejected)
   */
  requestApproval(actionDetails) {
    if (this.currentPolicy === 'autonomous') {
      return Promise.resolve({ approved: true, modifiedCommand: actionDetails.command });
    }

    return new Promise((resolve) => {
      this.pendingApproval = { actionDetails, resolve };
      this.renderAlert(actionDetails);
    });
  }

  renderAlert(action) {
    if (!this.alertContainer) return;

    this.alertContainer.innerHTML = `
      <div class="hitl-alert-card">
        <div class="hitl-header">
          <div class="hitl-icon">🛡️</div>
          <div class="hitl-title">
            <span>Human-in-the-Loop Approval Required</span>
            <span class="hitl-subtitle">${action.title || 'Privileged / Destructive Operation'}</span>
          </div>
        </div>

        <div style="font-size:11.5px;color:#fde68a;">
          <strong>Risk Assessment:</strong> ${action.risk}
        </div>

        <div class="hitl-command-preview" id="hitl-cmd-box" contenteditable="false">
          ${action.command}
        </div>

        <div style="font-size:11px;color:#cbd5e1;">
          <strong>Impact:</strong> ${action.impact}
        </div>

        <div class="hitl-actions">
          <button id="btn-hitl-approve" class="btn btn-primary btn-sm">✅ Approve & Execute</button>
          <button id="btn-hitl-edit" class="btn btn-secondary btn-sm">✏️ Edit Command</button>
          <button id="btn-hitl-reject" class="btn btn-danger-outline btn-sm">🛑 Reject Action</button>
        </div>
      </div>
    `;

    // Bind approval buttons
    const approveBtn = this.alertContainer.querySelector('#btn-hitl-approve');
    const editBtn = this.alertContainer.querySelector('#btn-hitl-edit');
    const rejectBtn = this.alertContainer.querySelector('#btn-hitl-reject');
    const cmdBox = this.alertContainer.querySelector('#hitl-cmd-box');

    let isEditing = false;
    editBtn.addEventListener('click', () => {
      isEditing = !isEditing;
      cmdBox.contentEditable = isEditing ? 'true' : 'false';
      if (isEditing) {
        cmdBox.focus();
        editBtn.innerText = '💾 Save Edit';
        cmdBox.style.background = '#1a1309';
        cmdBox.style.outline = '1px solid #f59e0b';
      } else {
        editBtn.innerText = '✏️ Edit Command';
        cmdBox.style.background = '#0d0905';
        cmdBox.style.outline = 'none';
      }
    });

    approveBtn.addEventListener('click', () => {
      const finalCmd = cmdBox.innerText.trim();
      this.clearAlert();
      if (this.pendingApproval) {
        this.pendingApproval.resolve({ approved: true, modifiedCommand: finalCmd });
        this.pendingApproval = null;
      }
    });

    rejectBtn.addEventListener('click', () => {
      this.clearAlert();
      if (this.pendingApproval) {
        this.pendingApproval.resolve({ approved: false });
        this.pendingApproval = null;
      }
    });
  }

  clearAlert() {
    if (this.alertContainer) {
      this.alertContainer.innerHTML = '';
    }
  }
}
