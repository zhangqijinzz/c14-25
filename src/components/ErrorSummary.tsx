import { useEffect, useRef } from 'react';
import { FIELD_ORDER, fieldLabel } from '../domain';
import type { FinanceScenario, ValidationErrors } from '../types';

interface Props {
  scenarios: FinanceScenario[];
  errors: Record<string, ValidationErrors>;
  onJump: (scenarioId: string, field: keyof ValidationErrors) => void;
}

// 集中错误入口：按情景分组列出所有未通过的字段，
// 条目是真正的链接（可 Tab 聚焦、回车触发），纯键盘也能逐项定位。
export function ErrorSummary({ scenarios, errors, onJump }: Props) {
  const containerRef = useRef<HTMLElement>(null);

  // 保存被拦、面板出现时把焦点送到摘要本身，读屏会直接朗读标题与条目数量。
  useEffect(() => { containerRef.current?.focus(); }, []);

  const groups = scenarios
    .map((scenario) => ({ scenario, fields: FIELD_ORDER.filter((field) => errors[scenario.id]?.[field]) }))
    .filter((group) => group.fields.length > 0);

  return (
    <section className="error-summary" aria-labelledby="error-summary-title" ref={containerRef} tabIndex={-1} role="alert">
      <h2 id="error-summary-title">还有参数未通过校验，无法保存</h2>
      <p className="error-summary__count">共 {groups.reduce((sum, group) => sum + group.fields.length, 0)} 项问题，分布在 {groups.length} 个情景中；选择任意一项即可跳到对应输入框。</p>
      {groups.map(({ scenario, fields }) => (
        <div className="error-summary__group" key={scenario.id}>
          <h3><span className="table-dot" style={{ background: scenario.color }} />{scenario.name}</h3>
          <ul>
            {fields.map((field) => (
              <li key={field}>
                <a
                  href={`#field-${scenario.id}-${field}`}
                  onClick={(event) => { event.preventDefault(); onJump(scenario.id, field); }}
                >
                  <strong>{fieldLabel(field)}</strong>
                  <span>{errors[scenario.id][field]}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
