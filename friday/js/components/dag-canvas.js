/**
 * frAIday — Interactive Task DAG Visualizer Component
 * Renders the LangGraph State Machine Execution DAG with live node telemetry
 */

export class DagCanvasComponent {
  constructor(container, onSelectNode) {
    this.container = container;
    this.onSelectNode = onSelectNode;
    this.nodes = this.getDefaultNodes();
    this.activeNodeId = 'goal_intake';
    this.render();
  }

  getDefaultNodes() {
    return [
      {
        id: 'goal_intake',
        title: 'Goal Intake & Intent Parsing',
        desc: 'Parse user prompt, analyze constraints, extract technical requirements and target deliverables.',
        status: 'pending'
      },
      {
        id: 'research',
        title: 'Research & Knowledge Discovery',
        desc: 'Autonomous web search for technical documentation, RFCs, API specifications, and design patterns.',
        status: 'pending'
      },
      {
        id: 'architecture_plan',
        title: 'Antigravity Architecture Plan',
        desc: 'Synthesize comprehensive implementation plan, file hierarchy, and step-by-step verification plan.',
        status: 'pending'
      },
      {
        id: 'planning_gate',
        title: 'Planning Gate: Human Approval',
        desc: 'Present architecture document for human review and sign-off before code changes begin.',
        status: 'pending'
      },
      {
        id: 'code_synthesis',
        title: 'Autonomous Code Synthesis',
        desc: 'Generate, write, and surgically patch source code files across HTML, CSS, JavaScript, and backend logic.',
        status: 'pending'
      },
      {
        id: 'verification',
        title: 'Verification & Automated Testing',
        desc: 'Run compiler checks, terminal test harnesses, and headless Chrome visual audits with DOM inspection.',
        status: 'pending'
      },
      {
        id: 'self_healing',
        title: 'Self-Healing & Error Remediation',
        desc: 'Intercept runtime errors, tracebacks, and test failures to autonomously patch code and re-verify.',
        status: 'pending'
      },
      {
        id: 'delivery',
        title: 'Walkthrough & Project Delivery',
        desc: 'Compile final walkthrough documentation, live preview validation, and artifact summary.',
        status: 'pending'
      }
    ];
  }

  setNodes(nodes, activeNodeId = null) {
    this.nodes = nodes || this.getDefaultNodes();
    this.activeNodeId = activeNodeId;
    this.render();
  }

  clear() {
    this.nodes = this.getDefaultNodes();
    this.activeNodeId = null;
    this.render();
  }

  updateNodeStatus(nodeId, newStatus) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.status = newStatus;
      this.render();
    }
  }

  setActiveStage(stageId, customDesc = null) {
    this.activeNodeId = stageId;
    const stageIndex = this.nodes.findIndex(n => n.id === stageId);
    if (stageIndex !== -1) {
      // Mark preceding nodes as completed
      for (let i = 0; i < stageIndex; i++) {
        if (this.nodes[i].status !== 'healed') {
          this.nodes[i].status = 'completed';
        }
      }
      this.nodes[stageIndex].status = 'active';
      if (customDesc) {
        this.nodes[stageIndex].desc = customDesc;
      }
      // Leave subsequent nodes as pending
      for (let i = stageIndex + 1; i < this.nodes.length; i++) {
        if (this.nodes[i].status !== 'completed' && this.nodes[i].status !== 'healed') {
          this.nodes[i].status = 'pending';
        }
      }
      this.render();
    }
  }

  markComplete() {
    this.nodes.forEach(n => {
      if (n.status !== 'healed') n.status = 'completed';
    });
    this.activeNodeId = null;
    this.render();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="dag-wrapper">
        <div class="dag-toolbar">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;font-weight:700;color:#f8fafc;">LangGraph Execution DAG & State Machine</span>
            <span class="brand-tag">${this.nodes.length} Stages</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:var(--text-muted);">
            <span style="display:flex;align-items:center;gap:4px;"><span style="color:#10b981;">●</span> Completed</span>
            <span style="display:flex;align-items:center;gap:4px;"><span style="color:#38bdf8;">●</span> Executing</span>
            <span style="display:flex;align-items:center;gap:4px;"><span style="color:#f59e0b;">●</span> HITL Gate</span>
            <span style="display:flex;align-items:center;gap:4px;"><span style="color:#ec4899;">●</span> Self-Healed</span>
            <span style="display:flex;align-items:center;gap:4px;"><span style="color:#64748b;">●</span> Queued</span>
          </div>
        </div>

        <div class="dag-canvas-area" style="flex:1;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:28px 24px 64px 24px;">
          <div class="dag-flow-container" style="display:flex;flex-direction:column;gap:16px;align-items:center;width:100%;max-width:760px;">
            ${this.nodes.map((node, index) => this.renderNode(node, index)).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderNode(node, index) {
    const isLast = index === this.nodes.length - 1;
    const isCurrent = node.id === this.activeNodeId || node.status === 'active';
    const statusClass = node.status || 'pending';

    const statusBadges = {
      completed: '<span class="tool-badge success" style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.15);color:#34d399;font-weight:700;">✔ COMPLETED</span>',
      active: '<span class="tool-badge running" style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(56,189,248,0.2);color:#38bdf8;font-weight:700;animation:pulse 1.5s infinite;">⚡ EXECUTING</span>',
      waiting: '<span class="tool-badge pending" style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,0.2);color:#fbbf24;font-weight:700;">⏳ WAITING APPROVAL</span>',
      healed: '<span class="tool-badge" style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(236,72,153,0.2);color:#ec4899;font-weight:700;">💖 SELF-HEALED</span>',
      pending: '<span class="tool-badge" style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,0.06);color:#94a3b8;font-weight:600;">QUEUED</span>'
    };

    return `
      <div class="dag-node-card ${statusClass} ${isCurrent ? 'active' : ''}" data-id="${node.id}" style="cursor:pointer;">
        <div class="dag-node-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div class="dag-node-title" style="display:flex;align-items:center;gap:8px;">
            <span style="color:#64748b;font-family:var(--font-mono);font-size:11px;font-weight:700;">#${String(index + 1).padStart(2, '0')}</span>
            <span style="font-weight:700;font-size:13px;color:#f8fafc;">${node.title}</span>
          </div>
          ${statusBadges[node.status] || statusBadges.pending}
        </div>
        <div class="dag-node-desc" style="font-size:12px;color:#94a3b8;line-height:1.5;">${node.desc}</div>
      </div>
      ${!isLast ? '<div class="dag-connector" style="height:24px;display:flex;align-items:center;justify-content:center;"><div style="width:2px;height:100%;background:rgba(255,255,255,0.1);"></div></div>' : ''}
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('.dag-node-card').forEach(card => {
      card.addEventListener('click', () => {
        const nodeId = card.getAttribute('data-id');
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && this.onSelectNode) {
          this.onSelectNode(node);
        }
      });
    });
  }
}
