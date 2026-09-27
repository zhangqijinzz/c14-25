import { useEffect, useRef } from 'react';
import './styles.css';
import { ComparisonChart } from './components/ComparisonChart';
import { ErrorSummary } from './components/ErrorSummary';
import { ScenarioForm } from './components/ScenarioForm';
import { ScenarioTable } from './components/ScenarioTable';
import { formatMoney } from './domain';
import type { ScenarioField } from './types';
import { useMoneyScenario } from './useMoneyScenario';

export default function App() {
  const viewModel = useMoneyScenario();
  const state = viewModel.getSnapshot();
  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);
  const handledSaveAttempts = useRef(state.saveAttempts);

  // 保存被拦截后，把焦点移到错误汇总标题，键盘用户可直接 Tab 到各个错误项
  useEffect(() => {
    if (state.saveAttempts !== handledSaveAttempts.current) {
      handledSaveAttempts.current = state.saveAttempts;
      summaryHeadingRef.current?.focus();
    }
  }, [state.saveAttempts]);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void viewModel.save();
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [viewModel]);

  const locateField = (scenarioId: string, field: ScenarioField) => {
    const input = document.getElementById(`field-${scenarioId}-${field}`);
    if (input instanceof HTMLElement) {
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      input.focus({ preventScroll: true });
    }
  };

  const totalValue = Math.max(...state.projections.map((projection) => projection.finalValue), 0);

  if (state.status === 'loading') return <div className="loading-screen"><div className="brand-mark">M</div><p>正在准备你的情景工作台…</p></div>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">M</div><div><strong>MoneyScenario</strong><span>资金情景推演器</span></div></div>
        <div className="topbar-actions"><span className="status-dot" />{state.message}<button className="save-button" type="button" onClick={() => void viewModel.save()}>保存比较 <span>⌘ S</span></button></div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="eyebrow">WORKSPACE</div>
          <h1>把未来变成<br /><em>可比较的选择</em></h1>
          <p className="intro">调整几个关键变量，观察长期资金路径如何分叉。所有数字均为模拟，不构成投资建议。</p>
          <div className="side-summary"><span>当前比较</span><strong>{state.scenarios.length} <small>个情景</small></strong><div className="summary-bar"><i style={{ width: `${Math.min(state.scenarios.length / 5 * 100, 100)}%` }} /></div><small>支持同时比较最多 5 个方案</small></div>
          <div className="side-tip"><span>✦</span><p><strong>试试看</strong><br />复制一个情景，只改收益率，感受复利的时间价值。</p></div>
        </aside>
        <section className="content">
          <div className="section-heading"><div><span className="eyebrow">01 · SCENARIOS</span><h2>编辑资金情景</h2></div><button className="secondary-button" type="button" onClick={() => viewModel.addScenario()}>＋ 新增情景</button></div>
          <ErrorSummary scenarios={state.scenarios} errors={state.errors} headingRef={summaryHeadingRef} onLocate={locateField} />
          <div className="scenario-list">
            {state.scenarios.map((scenario) => <ScenarioForm key={scenario.id} scenario={scenario} errors={state.errors[scenario.id] ?? {}} hints={state.hints[scenario.id] ?? {}} onUpdate={(field, value) => viewModel.updateField(scenario.id, field, value)} onCommit={(field) => viewModel.commitField(scenario.id, field)} onRename={(name) => viewModel.renameScenario(scenario.id, name)} onDuplicate={() => viewModel.duplicateScenario(scenario.id)} onRemove={() => viewModel.removeScenario(scenario.id)} />)}
          </div>

          <div className="results-heading"><div><span className="eyebrow">02 · OUTCOME</span><h2>长期结果对比</h2></div><div className="result-highlight"><span>最高名义终值</span><strong>¥ {formatMoney(totalValue)}</strong></div></div>
          {state.projections.length > 0 ? <><ComparisonChart scenarios={state.scenarios} projections={state.projections} /><ScenarioTable scenarios={state.scenarios} projections={state.projections} /></> : <div className="empty-result"><span>⌁</span><strong>修正参数后即可生成对比</strong><p>请根据上方错误汇总定位并修正参数，年限最多支持 60 年。</p></div>}
          <footer><span>ⓘ 结果为基于输入假设的数学模拟，不代表未来实际表现，也不构成任何投资建议。</span><span>本地优先 · 保存后可恢复</span></footer>
        </section>
      </div>
    </main>
  );
}
