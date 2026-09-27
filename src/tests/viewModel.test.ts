import { describe, expect, it } from 'vitest';
import { SAMPLE_SCENARIOS } from '../domain';
import type { PersistedWorkspace } from '../types';
import { MoneyScenarioViewModel } from '../viewModel';
import type { ScenarioRepository } from '../repository';

class MemoryRepository implements ScenarioRepository {
  constructor(private value: PersistedWorkspace | null = null, private failSave = false) {}
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

  it('restores saved state and surfaces invalid input', async () => {
    const saved = { version: 1 as const, scenarios: [{ ...SAMPLE_SCENARIOS[0], years: 12 }], selectedId: 'steady' };
    const vm = new MoneyScenarioViewModel(new MemoryRepository(saved));
    await vm.init();
    expect(vm.getSnapshot().scenarios[0].years).toBe(12);
    vm.updateField('steady', 'years', 99);
    // 编辑中内部口径仍然判定非法（推演不产出），但错误入口尚未打开。
    expect(vm.getSnapshot().errors.steady.years).toBeTruthy();
    expect(vm.getSnapshot().showErrorSummary).toBe(false);
    expect(vm.getSnapshot().projections).toHaveLength(0);
    // 离开输入框后错误被确认，保存前的完整拦截随即生效。
    vm.blurField('steady', 'years');
    expect(vm.getSnapshot().touched.steady.years).toBe(true);
  });

  it('keeps typing interruption-free: no blocking while focused even through transient digits', async () => {
    const vm = new MoneyScenarioViewModel(new MemoryRepository());
    await vm.init();
    // 模拟把年限从 20 改成 5：清空 -> 5 的过程，以及改成 500 的过程。
    vm.updateField('steady', 'years', Number.NaN);
    vm.updateField('steady', 'years', 5);
    expect(vm.getSnapshot().showErrorSummary).toBe(false);
    vm.updateField('steady', 'years', 500);
    expect(vm.getSnapshot().showErrorSummary).toBe(false);
    // 只要还没失焦确认，保存会用完整口径拦截并打开集中错误入口。
    void vm.save();
    expect(vm.getSnapshot().status).toBe('error');
    expect(vm.getSnapshot().showErrorSummary).toBe(true);
    expect(vm.getSnapshot().touched.steady.years).toBe(true);
  });

  it('dismisses the error summary once every field is corrected', async () => {
    const vm = new MoneyScenarioViewModel(new MemoryRepository());
    await vm.init();
    vm.updateField('steady', 'years', 99);
    void vm.save();
    expect(vm.getSnapshot().showErrorSummary).toBe(true);
    vm.updateField('steady', 'years', 30);
    expect(vm.getSnapshot().showErrorSummary).toBe(false);
    expect(vm.getSnapshot().projections).toHaveLength(3);
  });

  it('handles persistence failure without losing the editing state', async () => {
    const vm = new MoneyScenarioViewModel(new MemoryRepository(null, true));
    await vm.init();
    await vm.save();
    expect(vm.getSnapshot().status).toBe('error');
    expect(vm.getSnapshot().scenarios).toHaveLength(3);
  });
});
