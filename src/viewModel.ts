import { calculateProjection, COLORS, fieldInputId, SAMPLE_SCENARIOS, validateScenario } from './domain';
import type { ScenarioRepository } from './repository';
import type { FinanceScenario, PersistedWorkspace, ScenarioField, ScenarioProjection, TouchedFields, ValidationErrors } from './types';

export type ViewStatus = 'loading' | 'ready' | 'editing' | 'error' | 'completed';

export interface MoneyScenarioState {
  status: ViewStatus;
  scenarios: FinanceScenario[];
  selectedId: string;
  errors: Record<string, ValidationErrors>;
  touched: Record<string, TouchedFields>;
  showErrorSummary: boolean;
  projections: ScenarioProjection[];
  message: string;
}

type Listener = (state: MoneyScenarioState) => void;

function initialState(): MoneyScenarioState {
  return { status: 'loading', scenarios: [], selectedId: '', errors: {}, touched: {}, showErrorSummary: false, projections: [], message: '正在恢复最近的情景…' };
}

export class MoneyScenarioViewModel {
  private state: MoneyScenarioState = initialState();
  private readonly listeners = new Set<Listener>();
  private initialized = false;
  private readonly repository: ScenarioRepository;

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
      this.applyScenarios(saved?.scenarios?.length ? saved.scenarios : SAMPLE_SCENARIOS, saved?.selectedId ?? SAMPLE_SCENARIOS[0].id, saved ? '已恢复上次工作状态' : '已载入示例情景，可直接调整参数');
    } catch {
      this.applyScenarios(SAMPLE_SCENARIOS, SAMPLE_SCENARIOS[0].id, '本地数据读取失败，已使用示例情景');
      this.setState({ status: 'error', message: '本地数据读取失败，当前使用临时示例；仍可继续推演' });
    }
  }

  updateField(id: string, field: ScenarioField, value: number): void {
    const scenarios = this.state.scenarios.map((scenario) => scenario.id === id ? { ...scenario, [field]: value } : scenario);
    // 输入中只做实时推演，错误面板保持打开（若之前保存被拦），字段级拦截交给失焦确认。
    this.applyScenarios(scenarios, id, '参数已更新，结果实时刷新');
  }

  blurField(id: string, field: ScenarioField): void {
    const touched = { ...this.state.touched, [id]: { ...this.state.touched[id], [field]: true } };
    this.setState({ touched, status: Object.keys(this.state.errors).length ? 'editing' : 'ready' });
  }

  focusField(id: string, field: ScenarioField): void {
    if (typeof document === 'undefined') return;
    document.getElementById(fieldInputId(id, field))?.focus();
  }

  closeErrorSummary(): void {
    this.setState({ showErrorSummary: false });
  }

  renameScenario(id: string, name: string): void {
    const trimmed = name.trim().slice(0, 18);
    if (!trimmed) return;
    this.applyScenarios(this.state.scenarios.map((scenario) => scenario.id === id ? { ...scenario, name: trimmed } : scenario), id, '情景名称已更新');
  }

  addScenario(): void {
    if (this.state.scenarios.length >= 5) {
      this.setState({ message: '最多同时比较 5 个情景' });
      return;
    }
    const source = this.state.scenarios[this.state.scenarios.length - 1] ?? SAMPLE_SCENARIOS[0];
    const id = `scenario-${Date.now()}`;
    const scenario = { ...source, id, name: `情景 ${this.state.scenarios.length + 1}`, color: COLORS[this.state.scenarios.length % COLORS.length] };
    this.applyScenarios([...this.state.scenarios, scenario], id, '已新增情景');
  }

  duplicateScenario(id: string): void {
    if (this.state.scenarios.length >= 5) {
      this.setState({ message: '最多同时比较 5 个情景' });
      return;
    }
    const source = this.state.scenarios.find((scenario) => scenario.id === id);
    if (!source) return;
    const copy = { ...source, id: `scenario-${Date.now()}`, name: `${source.name} · 复制`, color: COLORS[this.state.scenarios.length % COLORS.length] };
    this.applyScenarios([...this.state.scenarios, copy], copy.id, '已复制情景，可修改任意参数比较差异');
  }

  removeScenario(id: string): void {
    if (this.state.scenarios.length <= 1) return;
    const scenarios = this.state.scenarios.filter((scenario) => scenario.id !== id);
    this.applyScenarios(scenarios, scenarios[0].id, '情景已移除');
  }

  async save(): Promise<void> {
    // 保存前使用与失焦后完全相同的完整口径重新校验，错误一项不放松。
    if (Object.keys(this.state.errors).length > 0) {
      const issueCount = Object.values(this.state.errors).reduce((sum, entry) => sum + Object.keys(entry).length, 0);
      this.setState({
        touched: this.allTouched(),
        showErrorSummary: true,
        status: 'error',
        message: `保存被拦截：还有 ${issueCount} 项参数未通过校验，请按错误清单逐项修正后再保存`,
      });
      return;
    }
    const workspace: PersistedWorkspace = { version: 1, scenarios: this.state.scenarios, selectedId: this.state.selectedId };
    try {
      await this.repository.save(workspace);
      this.setState({ showErrorSummary: false, status: 'completed', message: '比较已保存，本地刷新后仍可继续编辑' });
    } catch {
      this.setState({ status: 'error', message: '保存失败，请检查浏览器本地存储权限' });
    }
  }

  private applyScenarios(scenarios: FinanceScenario[], selectedId: string, message: string): void {
    const errors: Record<string, ValidationErrors> = {};
    const projections: ScenarioProjection[] = [];
    scenarios.forEach((scenario) => {
      const scenarioErrors = validateScenario(scenario);
      if (Object.keys(scenarioErrors).length) errors[scenario.id] = scenarioErrors;
      else projections.push(calculateProjection(scenario));
    });
    // 清理已删除情景的失焦记录，避免 id 复用时残留状态。
    const touched: Record<string, TouchedFields> = {};
    Object.keys(this.state.touched).forEach((id) => {
      if (scenarios.some((scenario) => scenario.id === id)) touched[id] = this.state.touched[id];
    });
    this.setState({
      scenarios,
      selectedId,
      errors,
      touched,
      showErrorSummary: this.state.showErrorSummary && Object.keys(errors).length > 0,
      projections,
      status: Object.keys(errors).length ? 'editing' : 'ready',
      message,
    });
  }

  // 保存被拦时把全部字段视为已确认，让红色错误直接落到每个出错的输入框上。
  private allTouched(): Record<string, TouchedFields> {
    const touched: Record<string, TouchedFields> = {};
    Object.keys(this.state.errors).forEach((id) => {
      touched[id] = { ...this.state.touched[id] };
      Object.keys(this.state.errors[id]).forEach((field) => { touched[id][field as ScenarioField] = true; });
    });
    return touched;
  }

  private setState(patch: Partial<MoneyScenarioState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
