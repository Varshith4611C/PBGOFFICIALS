/**
 * frAIday — LangGraph State Machine Engine
 * 
 * Implements a cyclic StateGraph with:
 * - Typed state transitions
 * - Dynamic node execution
 * - Conditional edges & self-healing loops
 * - Checkpointing & Human-In-The-Loop (HITL) pause/resume gates
 * - Event telemetry for Cockpit and DAG visualization
 */

export const END = '__END__';
export const START = '__START__';

export class StateGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.conditionalEdges = new Map();
    this.entryPoint = null;
    this.finishPoint = END;
  }

  addNode(name, fn) {
    if (this.nodes.has(name)) {
      throw new Error(`Node "${name}" is already registered in StateGraph.`);
    }
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(fromNode, toNode) {
    this.edges.set(fromNode, toNode);
    return this;
  }

  addConditionalEdges(fromNode, conditionFn, pathMap = {}) {
    this.conditionalEdges.set(fromNode, { conditionFn, pathMap });
    return this;
  }

  setEntryPoint(name) {
    this.entryPoint = name;
    return this;
  }

  setFinishPoint(name) {
    this.finishPoint = name;
    return this;
  }

  compile() {
    if (!this.entryPoint) {
      throw new Error('StateGraph must define an entryPoint before compilation.');
    }
    return new CompiledStateGraph(this);
  }
}

export class CompiledStateGraph {
  constructor(graph) {
    this.graph = graph;
    this.activeState = null;
    this.currentNode = null;
    this.history = [];
    this.checkpoint = null;
    this.isPaused = false;
  }

  async invoke(initialState, config = {}) {
    this.activeState = { ...initialState };
    this.currentNode = this.graph.entryPoint;
    this.isPaused = false;
    this.history = [];

    const maxSteps = config.maxSteps || 35;
    let stepCount = 0;

    while (this.currentNode && this.currentNode !== END && stepCount < maxSteps) {
      stepCount++;
      const nodeName = this.currentNode;
      const nodeFn = this.graph.nodes.get(nodeName);

      if (!nodeFn) {
        throw new Error(`StateGraph execution error: Node "${nodeName}" not found.`);
      }

      // 1. Notify node start
      if (config.onNodeStart) {
        await config.onNodeStart(nodeName, this.activeState);
      }

      // 2. Execute node
      const startTime = performance.now();
      let nodeResult = {};
      try {
        nodeResult = await nodeFn(this.activeState, config) || {};
      } catch (err) {
        console.error(`Error in StateGraph node "${nodeName}":`, err);
        if (config.onNodeError) {
          await config.onNodeError(nodeName, err, this.activeState);
        }
        throw err;
      }
      const durationMs = Math.round(performance.now() - startTime);

      // Merge updated state
      this.activeState = { ...this.activeState, ...nodeResult };
      this.history.push({
        node: nodeName,
        timestamp: Date.now(),
        durationMs,
        stateSnapshot: { ...this.activeState }
      });

      // 3. Notify node complete
      if (config.onNodeEnd) {
        await config.onNodeEnd(nodeName, this.activeState);
      }

      // 4. Check for Human-In-The-Loop Pause Gate
      if (this.activeState.awaiting_approval) {
        this.isPaused = true;
        this.checkpoint = {
          node: nodeName,
          state: { ...this.activeState },
          stepCount
        };
        if (config.onAwaitingApproval) {
          await config.onAwaitingApproval(this.activeState);
        }
        return {
          status: 'paused_for_approval',
          node: nodeName,
          state: this.activeState
        };
      }

      // 5. Determine Next Node via Conditional Edge or Direct Edge
      if (this.graph.conditionalEdges.has(nodeName)) {
        const { conditionFn, pathMap } = this.graph.conditionalEdges.get(nodeName);
        const conditionResult = await conditionFn(this.activeState);
        const nextNode = pathMap[conditionResult] || conditionResult;
        this.currentNode = nextNode || END;
      } else if (this.graph.edges.has(nodeName)) {
        this.currentNode = this.graph.edges.get(nodeName);
      } else {
        this.currentNode = END;
      }
    }

    if (stepCount >= maxSteps) {
      console.warn(`StateGraph terminated after exceeding maxSteps (${maxSteps}).`);
    }

    if (config.onComplete) {
      await config.onComplete(this.activeState);
    }

    return {
      status: 'completed',
      state: this.activeState,
      history: this.history
    };
  }

  async resume(stateUpdate = {}, config = {}) {
    if (!this.checkpoint) {
      throw new Error('Cannot resume StateGraph: No active checkpoint found.');
    }

    // Merge resume update (e.g. { planApproved: true, awaiting_approval: false })
    this.activeState = {
      ...this.checkpoint.state,
      ...stateUpdate,
      awaiting_approval: false
    };

    const nodeName = this.checkpoint.node;
    this.checkpoint = null;
    this.isPaused = false;

    // Determine next node from where it paused
    if (this.graph.conditionalEdges.has(nodeName)) {
      const { conditionFn, pathMap } = this.graph.conditionalEdges.get(nodeName);
      const conditionResult = await conditionFn(this.activeState);
      this.currentNode = pathMap[conditionResult] || conditionResult || END;
    } else if (this.graph.edges.has(nodeName)) {
      this.currentNode = this.graph.edges.get(nodeName);
    } else {
      this.currentNode = END;
    }

    // Resume execution loop
    return await this.invoke(this.activeState, config);
  }
}
