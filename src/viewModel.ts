import { calculateProjection, COLORS, fieldLabel, SAMPLE_SCENARIOS, validateScenario } from './domain';
import type { ScenarioRepository } from './repository';
import type { FinanceScenario, PersistedWorkspace, ScenarioField, ScenarioProjection, ValidationErrors } from './types';

export type ViewStatus = 'loading' | 'ready' | 'editing' | 'error' | 'completed';

export interface MoneyScenarioState {
  status: ViewStatus;
  scenarios: FinanceScenario[];
  selectedId: string;
  /** 已提交的拦截错误（失焦或保存前产生），红色展示并阻止保存 */
  errors: Record<string, ValidationErrors>;
  /** 编辑过程中的轻量提示，只提醒、不拦截 */
  hints: Record<string, ValidationErrors>;
  projections: ScenarioProjection[];
  message: string;
  /** 保存被拦截的次数，用于把焦点移到错误汇总 */
  saveAttempts: number;
}

type Listener = (state: MoneyScenarioState) => void;

function initialState(): MoneyScenarioState {
  return { status: 'loading', scenarios: [], selectedId: '', errors: {}, hints: {}, projections: [], message: '正在恢复最近的情景…', saveAttempts: 0 };
}

function fieldKey(id: string, field: ScenarioField): string {
  return `${id}:${field}`;
}

export class MoneyScenarioViewModel {
  private state: MoneyScenarioState = initialState();
  private readonly listeners = new Set<Listener>();
  private initialized = false;
  private readonly repository: ScenarioRepository;
  /** 已失焦或保存时被拦截的字段，这些字段的校验结果升级为红色错误 */
  private readonly committedFields = new Set<string>();

  constructor(repository: ScenarioRepository) {
    this.repository = repository;
  }

  getSnapshot(): MoneyScenarioState { return this.state; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const saved = await this.repository.load();
      const scenarios = saved?.scenarios?.length ? saved.scenarios : SAMPLE_SCENARIOS;
      this.commitAllFields(scenarios);
      this.recompute(scenarios, saved?.selectedId ?? scenarios[0].id, saved ? '已恢复上次工作状态' : '已载入示例情景，可直接调整参数');
    } catch {
      this.commitAllFields(SAMPLE_SCENARIOS);
      this.recompute(SAMPLE_SCENARIOS, SAMPLE_SCENARIOS[0].id, '本地数据读取失败，已使用示例情景');
      this.setState({ status: 'error', message: '本地数据读取失败，当前使用临时示例；仍可继续推演' });
    }
  }

  updateField(id: string, field: ScenarioField, value: number): void {
    // 正在编辑的字段降级为轻量提示，失焦或保存时才升级为拦截错误
    this.committedFields.delete(fieldKey(id, field));
    const scenarios = this.state.scenarios.map((scenario) => scenario.id === id ? { ...scenario, [field]: value } : scenario);
    this.recompute(scenarios, id, '参数已更新，结果实时刷新');
  }

  commitField(id: string, field: ScenarioField): void {
    const scenario = this.state.scenarios.find((item) => item.id === id);
    if (!scenario) return;
    const scenarioErrors = validateScenario(scenario);
    if (scenarioErrors[field]) {
      this.committedFields.add(fieldKey(id, field));
      this.recompute(this.state.scenarios, id, `${fieldLabel(field)}未通过检查，已标红，修正后才能保存`);
    } else {
      this.committedFields.delete(fieldKey(id, field));
      this.recompute(this.state.scenarios, id, '参数已更新，结果实时刷新');
    }
  }

  renameScenario(id: string, name: string): void {
    const trimmed = name.trim().slice(0, 18);
    if (!trimmed) return;
    this.recompute(this.state.scenarios.map((scenario) => scenario.id === id ? { ...scenario, name: trimmed } : scenario), id, '情景名称已更新');
  }

  addScenario(): void {
    if (this.state.scenarios.length >= 5) {
      this.setState({ message: '最多同时比较 5 个情景' });
      return;
    }
    const source = this.state.scenarios[this.state.scenarios.length - 1] ?? SAMPLE_SCENARIOS[0];
    const id = `scenario-${Date.now()}`;
    const scenario = { ...source, id, name: `情景 ${this.state.scenarios.length + 1}`, color: COLORS[this.state.scenarios.length % COLORS.length] };
    this.recompute([...this.state.scenarios, scenario], id, '已新增情景');
  }

  duplicateScenario(id: string): void {
    if (this.state.scenarios.length >= 5) {
      this.setState({ message: '最多同时比较 5 个情景' });
      return;
    }
    const source = this.state.scenarios.find((scenario) => scenario.id === id);
    if (!source) return;
    const copy = { ...source, id: `scenario-${Date.now()}`, name: `${source.name} · 复制`, color: COLORS[this.state.scenarios.length % COLORS.length] };
    this.recompute([...this.state.scenarios, copy], copy.id, '已复制情景，可修改任意参数比较差异');
  }

  removeScenario(id: string): void {
    if (this.state.scenarios.length <= 1) return;
    const scenarios = this.state.scenarios.filter((scenario) => scenario.id !== id);
    this.committedFields.forEach((key) => { if (key.startsWith(`${id}:`)) this.committedFields.delete(key); });
    this.recompute(scenarios, scenarios[0].id, '情景已移除');
  }

  async save(): Promise<void> {
    // 保存前统一提交校验：所有未通过项都升级为拦截错误，口径与编辑中一致
    const invalidCount = this.commitAllFields(this.state.scenarios);
    if (invalidCount > 0) {
      this.recompute(this.state.scenarios, this.state.selectedId, `保存被拦截：请先修正 ${invalidCount} 处标红参数`);
      this.setState({ status: 'error', saveAttempts: this.state.saveAttempts + 1 });
      return;
    }
    const workspace: PersistedWorkspace = { version: 1, scenarios: this.state.scenarios, selectedId: this.state.selectedId };
    try {
      await this.repository.save(workspace);
      this.setState({ status: 'completed', message: '比较已保存，本地刷新后仍可继续编辑' });
    } catch {
      this.setState({ status: 'error', message: '保存失败，请检查浏览器本地存储权限' });
    }
  }

  private commitAllFields(scenarios: FinanceScenario[]): number {
    let count = 0;
    scenarios.forEach((scenario) => {
      const scenarioErrors = validateScenario(scenario);
      (Object.keys(scenarioErrors) as ScenarioField[]).forEach((field) => {
        this.committedFields.add(fieldKey(scenario.id, field));
        count += 1;
      });
    });
    return count;
  }

  private recompute(scenarios: FinanceScenario[], selectedId: string, message: string): void {
    const errors: Record<string, ValidationErrors> = {};
    const hints: Record<string, ValidationErrors> = {};
    const projections: ScenarioProjection[] = [];
    let invalidCount = 0;
    scenarios.forEach((scenario) => {
      const scenarioErrors = validateScenario(scenario);
      const fields = Object.keys(scenarioErrors) as ScenarioField[];
      if (fields.length === 0) {
        projections.push(calculateProjection(scenario));
        return;
      }
      invalidCount += fields.length;
      fields.forEach((field) => {
        const bucket = this.committedFields.has(fieldKey(scenario.id, field)) ? errors : hints;
        const entry = bucket[scenario.id] ?? (bucket[scenario.id] = {});
        entry[field] = scenarioErrors[field];
      });
    });
    this.setState({ scenarios, selectedId, errors, hints, projections, status: invalidCount > 0 ? 'editing' : 'ready', message });
  }

  private setState(patch: Partial<MoneyScenarioState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
