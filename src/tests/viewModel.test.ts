import { describe, expect, it } from 'vitest';
import { SAMPLE_SCENARIOS } from '../domain';
import type { PersistedWorkspace } from '../types';
import { MoneyScenarioViewModel } from '../viewModel';
import type { ScenarioRepository } from '../repository';

class MemoryRepository implements ScenarioRepository {
  constructor(private value: PersistedWorkspace | null = null, private failSave = false) {}
  get stored() { return this.value; }
  async load() { return this.value; }
  async save(workspace: PersistedWorkspace) { if (this.failSave) throw new Error('storage'); this.value = workspace; }
}

describe('MoneyScenarioViewModel', () => {
  it('initializes sample scenarios and updates projections', async () => {
    const vm = new MoneyScenarioViewModel(new MemoryRepository());
    await vm.init();
    expect(vm.getSnapshot().scenarios).toHaveLength(3);
    vm.updateField('steady', 'years', 30);
    expect(vm.getSnapshot().projections[0].points).toHaveLength(31);
  });

  it('restores saved state and only hints while typing, blocks on blur', async () => {
    const saved = { version: 1 as const, scenarios: [{ ...SAMPLE_SCENARIOS[0], years: 12 }], selectedId: 'steady' };
    const vm = new MoneyScenarioViewModel(new MemoryRepository(saved));
    await vm.init();
    expect(vm.getSnapshot().scenarios[0].years).toBe(12);
    vm.updateField('steady', 'years', 99);
    // 编辑中：只有轻量提示，不出现拦截错误，但该情景仍被排除出推演结果
    expect(vm.getSnapshot().hints.steady.years).toBeTruthy();
    expect(vm.getSnapshot().errors.steady).toBeUndefined();
    expect(vm.getSnapshot().projections).toHaveLength(0);
    // 失焦后：同一输入升级为拦截错误
    vm.commitField('steady', 'years');
    expect(vm.getSnapshot().errors.steady.years).toBeTruthy();
    expect(vm.getSnapshot().hints.steady).toBeUndefined();
  });

  it('demotes a blocking error back to a hint while editing again', async () => {
    const vm = new MoneyScenarioViewModel(new MemoryRepository());
    await vm.init();
    vm.updateField('steady', 'years', 99);
    vm.commitField('steady', 'years');
    expect(vm.getSnapshot().errors.steady.years).toBeTruthy();
    vm.updateField('steady', 'years', 100);
    expect(vm.getSnapshot().errors.steady).toBeUndefined();
    expect(vm.getSnapshot().hints.steady.years).toBeTruthy();
    vm.updateField('steady', 'years', 5);
    expect(vm.getSnapshot().hints.steady).toBeUndefined();
    expect(vm.getSnapshot().projections).toHaveLength(3);
  });

  it('blocks save until every invalid field is fixed, without relaxing rules', async () => {
    const repository = new MemoryRepository();
    const vm = new MoneyScenarioViewModel(repository);
    await vm.init();
    vm.updateField('steady', 'years', 99);
    await vm.save();
    // 保存被拦截：未失焦的字段也被提交为拦截错误，且未写入存储
    expect(vm.getSnapshot().status).toBe('error');
    expect(vm.getSnapshot().message).toContain('拦截');
    expect(vm.getSnapshot().errors.steady.years).toBeTruthy();
    expect(vm.getSnapshot().saveAttempts).toBe(1);
    expect(repository.stored).toBeNull();
    // 改成合法值后才能保存
    vm.updateField('steady', 'years', 5);
    await vm.save();
    expect(vm.getSnapshot().status).toBe('completed');
    expect(repository.stored?.scenarios[0].years).toBe(5);
  });

  it('handles persistence failure without losing the editing state', async () => {
    const vm = new MoneyScenarioViewModel(new MemoryRepository(null, true));
    await vm.init();
    await vm.save();
    expect(vm.getSnapshot().status).toBe('error');
    expect(vm.getSnapshot().scenarios).toHaveLength(3);
  });
});
