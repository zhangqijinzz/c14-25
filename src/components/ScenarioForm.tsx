import { useState, type CSSProperties } from 'react';
import { editingHint, fieldErrorId, fieldHintId, fieldInputId, fieldLabel } from '../domain';
import type { FinanceScenario, ScenarioField, TouchedFields, ValidationErrors } from '../types';

const fields: Array<{ key: ScenarioField; suffix: string; step: string }> = [
  { key: 'principal', suffix: '元', step: '1000' },
  { key: 'recurring', suffix: '元 / 月', step: '100' },
  { key: 'years', suffix: '年', step: '1' },
  { key: 'annualRate', suffix: '% / 年', step: '0.1' },
  { key: 'inflationRate', suffix: '% / 年', step: '0.1' },
  { key: 'feeRate', suffix: '% / 年', step: '0.1' },
];

interface Props {
  scenario: FinanceScenario;
  errors: ValidationErrors;
  touched: TouchedFields;
  showErrorSummary: boolean;
  onUpdate: (field: ScenarioField, value: number) => void;
  onBlurField: (field: ScenarioField) => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function ScenarioForm({ scenario, errors, touched, showErrorSummary, onUpdate, onBlurField, onRename, onDuplicate, onRemove }: Props) {
  const [focusedField, setFocusedField] = useState<ScenarioField | null>(null);
  const errorCount = Object.keys(errors).length;

  return (
    <section className="scenario-card" style={{ '--accent': scenario.color } as CSSProperties}>
      <div className="scenario-card__head">
        <span className="scenario-dot" />
        <input className="scenario-name" aria-label="情景名称" value={scenario.name} onChange={(event) => onRename(event.target.value)} />
        {errorCount > 0 && showErrorSummary && <span className="scenario-badge" aria-label={`本情景有 ${errorCount} 项参数未通过校验`}>{errorCount} 项待修正</span>}
        <button className="icon-button" type="button" onClick={onDuplicate} title="复制情景" aria-label="复制情景">＋</button>
        <button className="icon-button muted" type="button" onClick={onRemove} title="删除情景" aria-label="删除情景">×</button>
      </div>
      <div className="field-grid">
        {fields.map(({ key, suffix, step }) => {
          const isFocused = focusedField === key;
          const blocking = Boolean(errors[key]) && !isFocused && (Boolean(touched[key]) || showErrorSummary);
          const hint = isFocused ? editingHint(scenario, key) : null;
          const describedBy = blocking ? fieldErrorId(scenario.id, key) : hint ? fieldHintId(scenario.id, key) : undefined;
          return (
            <label className="field" key={key}>
              <span>{fieldLabel(key)}</span>
              <div className={`input-wrap ${blocking ? 'has-error' : ''} ${hint ? 'has-hint' : ''}`}>
                <input
                  id={fieldInputId(scenario.id, key)}
                  aria-label={`${scenario.name} ${fieldLabel(key)}`}
                  aria-invalid={blocking || undefined}
                  aria-describedby={describedBy}
                  type="number"
                  min={key === 'years' ? 1 : undefined}
                  max={key === 'years' ? 60 : undefined}
                  step={step}
                  value={Number.isNaN(scenario[key]) ? '' : scenario[key]}
                  onChange={(event) => onUpdate(key, event.target.value === '' ? Number.NaN : Number(event.target.value))}
                  onFocus={() => setFocusedField(key)}
                  onBlur={() => { setFocusedField(null); onBlurField(key); }}
                />
                <em>{suffix}</em>
              </div>
              {blocking && <small className="error-text" id={fieldErrorId(scenario.id, key)} role="alert">{errors[key]}</small>}
              {!blocking && hint && <small className="hint-text" id={fieldHintId(scenario.id, key)}>{hint}</small>}
            </label>
          );
        })}
      </div>
    </section>
  );
}
