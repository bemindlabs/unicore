import { WorkflowStateStore } from '../src/state/workflow-state.store';
import type { WorkflowInstance } from '../src/state/workflow-instance';

function makeInstance(overrides: Partial<WorkflowInstance> = {}): WorkflowInstance {
  return {
    instanceId: 'inst-1',
    workflowId: 'wf-1',
    workflowName: 'Test Workflow',
    status: 'pending',
    triggerPayload: {},
    actions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('WorkflowStateStore', () => {
  let store: WorkflowStateStore;

  beforeEach(() => { store = new WorkflowStateStore(); });

  it('saves and retrieves an instance by ID', () => {
    const inst = makeInstance();
    store.save(inst);
    expect(store.findById('inst-1')).toMatchObject({ instanceId: 'inst-1' });
  });

  it('returns undefined for missing ID', () => {
    expect(store.findById('missing')).toBeUndefined();
  });

  it('returns a copy so mutations do not affect the store', () => {
    const inst = makeInstance();
    store.save(inst);
    const retrieved = store.findById('inst-1')!;
    retrieved.status = 'completed';
    expect(store.findById('inst-1')!.status).toBe('pending');
  });

  it('findByWorkflowId filters correctly', () => {
    store.save(makeInstance({ instanceId: 'a', workflowId: 'wf-1' }));
    store.save(makeInstance({ instanceId: 'b', workflowId: 'wf-2' }));
    store.save(makeInstance({ instanceId: 'c', workflowId: 'wf-1' }));
    const results = store.findByWorkflowId('wf-1');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.workflowId === 'wf-1')).toBe(true);
  });

  it('findByStatus filters correctly', () => {
    store.save(makeInstance({ instanceId: 'a', status: 'running' }));
    store.save(makeInstance({ instanceId: 'b', status: 'completed' }));
    store.save(makeInstance({ instanceId: 'c', status: 'running' }));
    expect(store.findByStatus('running')).toHaveLength(2);
  });

  it('findAll returns all instances', () => {
    store.save(makeInstance({ instanceId: 'a' }));
    store.save(makeInstance({ instanceId: 'b' }));
    expect(store.findAll()).toHaveLength(2);
  });

  it('delete removes instance and returns true', () => {
    store.save(makeInstance());
    expect(store.delete('inst-1')).toBe(true);
    expect(store.findById('inst-1')).toBeUndefined();
  });

  it('delete returns false for non-existent instance', () => {
    expect(store.delete('missing')).toBe(false);
  });

  it('count reflects number of stored instances', () => {
    expect(store.count()).toBe(0);
    store.save(makeInstance({ instanceId: 'a' }));
    store.save(makeInstance({ instanceId: 'b' }));
    expect(store.count()).toBe(2);
  });
});
