import type {
  FinanceScenario,
  ProjectionPoint,
  ScenarioField,
  ScenarioProjection,
  ValidationErrors,
} from './types';

export const COLORS = ['#e4774e', '#286f68', '#5e65c7', '#c49336', '#b45d88'];

export const SAMPLE_SCENARIOS: FinanceScenario[] = [
  { id: 'steady', name: '稳健积累', color: COLORS[0], principal: 30000, recurring: 1500, years: 20, annualRate: 4.5, inflationRate: 2, feeRate: 0.4 },
  { id: 'balanced', name: '平衡增长', color: COLORS[1], principal: 30000, recurring: 1500, years: 20, annualRate: 7, inflationRate: 2, feeRate: 0.6 },
  { id: 'growth', name: '长期增长', color: COLORS[2], principal: 30000, recurring: 1500, years: 20, annualRate: 9, inflationRate: 2.5, feeRate: 0.8 },
];

export const FIELD_ORDER: ScenarioField[] = ['principal', 'recurring', 'years', 'annualRate', 'inflationRate', 'feeRate'];

export function fieldInputId(scenarioId: string, field: ScenarioField): string {
  return `field-${scenarioId}-${field}`;
}

export function fieldErrorId(scenarioId: string, field: ScenarioField): string {
  return `field-error-${scenarioId}-${field}`;
}

export function fieldHintId(scenarioId: string, field: ScenarioField): string {
  return `field-hint-${scenarioId}-${field}`;
}

export function validateScenario(scenario: FinanceScenario): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!Number.isFinite(scenario.principal) || scenario.principal < 0) errors.principal = '初始金额不能为负，请输入不小于 0 的金额';
  if (!Number.isFinite(scenario.recurring) || scenario.recurring < 0) errors.recurring = '每月投入不能为负，请输入不小于 0 的金额';
  if (!Number.isInteger(scenario.years) || scenario.years < 1 || scenario.years > 60) errors.years = '投资年限必须是 1–60 之间的整数，否则无法保存';
  if (!Number.isFinite(scenario.annualRate) || scenario.annualRate < -50 || scenario.annualRate > 100) errors.annualRate = '年化收益需落在 -50% 至 100% 之间，否则无法保存';
  if (!Number.isFinite(scenario.inflationRate) || scenario.inflationRate < 0 || scenario.inflationRate > 30) errors.inflationRate = '通胀率需落在 0% 至 30% 之间，否则无法保存';
  if (!Number.isFinite(scenario.feeRate) || scenario.feeRate < 0 || scenario.feeRate > 10) errors.feeRate = '费用率需落在 0% 至 10% 之间，否则无法保存';
  return errors;
}

// 编辑过程中的轻量提示：措辞刻意区别于失焦/保存时的拦截文案，
// 且不标红，只在输入框聚焦期间显示，离开输入框后改由完整校验接管。
export function editingHint(scenario: FinanceScenario, field: ScenarioField): string | null {
  const value = scenario[field];
  if (!Number.isFinite(value)) return `输入中：${fieldLabel(field)}需要一个数字`;
  switch (field) {
    case 'principal':
      return value < 0 ? '输入中：初始金额不能小于 0 元' : null;
    case 'recurring':
      return value < 0 ? '输入中：每月投入不能小于 0 元' : null;
    case 'years':
      if (!Number.isInteger(value)) return '输入中：年限请填写整数';
      if (value < 1 || value > 60) return '输入中：年限将按 1–60 年计算';
      return null;
    case 'annualRate':
      return value < -50 || value > 100 ? '输入中：收益率通常在 -50% 至 100% 之间' : null;
    case 'inflationRate':
      return value < 0 || value > 30 ? '输入中：通胀率通常在 0% 至 30% 之间' : null;
    case 'feeRate':
      return value < 0 || value > 10 ? '输入中：费用率通常在 0% 至 10% 之间' : null;
  }
}

export function calculateProjection(scenario: FinanceScenario): ScenarioProjection {
  const monthlyRate = Math.pow(1 + (scenario.annualRate - scenario.feeRate) / 100, 1 / 12) - 1;
  let nominal = scenario.principal;
  let invested = scenario.principal;
  const points: ProjectionPoint[] = [{ year: 0, nominal, real: nominal, invested }];

  for (let month = 1; month <= scenario.years * 12; month += 1) {
    nominal = nominal * (1 + monthlyRate) + scenario.recurring;
    invested += scenario.recurring;
    if (month % 12 === 0) {
      const year = month / 12;
      points.push({ year, nominal, real: nominal / Math.pow(1 + scenario.inflationRate / 100, year), invested });
    }
  }
  const final = points[points.length - 1];
  return { scenarioId: scenario.id, points, finalValue: final.nominal, finalRealValue: final.real, totalInvested: final.invested };
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function fieldLabel(field: ScenarioField): string {
  return { principal: '初始金额', recurring: '每月投入', years: '投资年限', annualRate: '年化收益', inflationRate: '通胀率', feeRate: '费用率' }[field];
}
