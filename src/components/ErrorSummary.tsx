import type { RefObject } from 'react';
import { blockingMessage, fieldLabel } from '../domain';
import type { FinanceScenario, ScenarioField, ValidationErrors } from '../types';

interface Props {
  scenarios: FinanceScenario[];
  errors: Record<string, ValidationErrors>;
  headingRef: RefObject<HTMLHeadingElement>;
  onLocate: (scenarioId: string, field: ScenarioField) => void;
}

export function ErrorSummary({ scenarios, errors, headingRef, onLocate }: Props) {
  const groups = scenarios
    .map((scenario) => ({
      scenario,
      fieldErrors: Object.entries(errors[scenario.id] ?? {}) as Array<[ScenarioField, string]>,
    }))
    .filter((group) => group.fieldErrors.length > 0);
  if (groups.length === 0) return null;
  const total = groups.reduce((count, group) => count + group.fieldErrors.length, 0);

  return (
    <section className="error-summary" aria-live="polite" aria-label="参数错误汇总">
      <h3 tabIndex={-1} ref={headingRef}>⚠ {groups.length} 个情景共 {total} 处参数需要修正</h3>
      <ul className="error-summary__list">
        {groups.map(({ scenario, fieldErrors }) => (
          <li key={scenario.id}>
            <span className="error-summary__scenario"><i style={{ background: scenario.color }} />{scenario.name}</span>
            <ul>
              {fieldErrors.map(([field, message]) => (
                <li key={field}>
                  <button type="button" className="error-summary__jump" onClick={() => onLocate(scenario.id, field)}>
                    {fieldLabel(field)} · {blockingMessage(message)}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
