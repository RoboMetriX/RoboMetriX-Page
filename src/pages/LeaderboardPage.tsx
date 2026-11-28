import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Play } from 'lucide-react';
import type { CategoryId, EpisodeSummary, IndexPayload, Lang, Protocol } from '../types/benchmark';
import {
  CATEGORIES,
  CROSS_PLATFORM_RESULTS,
  TASK_BY_ID,
  TASKS,
} from '../data/benchmarkMeta';
import { t } from '../lib/i18n';
import { buildExplorerHref, buildTrajectoryHref } from '../lib/router';
import { ModalDialog } from '../components/ModalDialog';
import { ScoreBar } from '../components/MetricGauge';
import { FamilyPill, getFamilySpec, ProviderGlyph, RankBadge } from '../components/ProviderBadge';

interface LeaderboardPageProps {
  index: IndexPayload;
  lang: Lang;
  tab?: 'main' | 'matrix' | 'cross-platform';
}

type RankBy = 'execution' | 'qa';
type DisplayMode = 'paired' | 'single';
type MatrixView = 'execution' | 'qa' | 'gap';
type SortKey = 'model' | CategoryId | 'mean';

interface ModelAggregate {
  modelId: string;
  label: string;
  short: string;
  effort: string;
  family: string;
  exec: Record<CategoryId | 'mean', number>;
  qa: Record<CategoryId | 'mean', number>;
  gap: Record<CategoryId | 'mean', number>;
  perTaskExec: Record<string, number>;
  perTaskQa: Record<string, number>;
}

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function heatCellColors(val: number, isGap: boolean): { bg: string; fg: string } {
  if (isGap) {
    const tNorm = Math.max(0, Math.min(1, val / 85));
    if (tNorm < 0.12) return { bg: '#f8fafc', fg: '#334155' };
    if (tNorm < 0.35) return { bg: '#fef3c7', fg: '#78350f' };
    if (tNorm < 0.62) return { bg: '#fcd34d', fg: '#451a03' };
    return { bg: '#b45309', fg: '#ffffff' };
  }
  const tNorm = Math.max(0, Math.min(1, val / 100));
  if (tNorm < 0.08) return { bg: '#f1f5f9', fg: '#334155' };
  if (tNorm < 0.28) return { bg: '#dbeafe', fg: '#1e3a8a' };
  if (tNorm < 0.52) return { bg: '#93c5fd', fg: '#0f172a' };
  if (tNorm < 0.74) return { bg: '#1d4ed8', fg: '#ffffff' };
  return { bg: '#1e3a8a', fg: '#ffffff' };
}

function preferredScrollBehavior(): ScrollBehavior {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'auto';
  }
  return 'smooth';
}

export function LeaderboardPage({ index, lang, tab }: LeaderboardPageProps) {
  const tr = t(lang);

  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
    const heading = section.querySelector<HTMLElement>('h2[tabindex="-1"]') ?? section;
    heading.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!tab) return;
    const map: Record<NonNullable<LeaderboardPageProps['tab']>, string> = {
      main: 'lb-main',
      matrix: 'lb-matrix',
      'cross-platform': 'lb-cross',
    };
    const id = map[tab];
    if (id) {
      requestAnimationFrame(() => {
        scrollToSection(id);
      });
    }
  }, [tab]);

  // Main table controls (RoboDojo-style inline pill toolbar)
  const [rankBy, setRankBy] = useState<RankBy>('execution');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('paired');
  const [effortFilter, setEffortFilter] = useState<'all' | 'medium' | 'high'>('all');
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('mean');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortStatus, setSortStatus] = useState('');

  // Frontier visualization controls
  const [chartMode, setChartMode] = useState<'frontier' | 'scatter'>('frontier');
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  // Matrix view + drilldown
  const [matrixView, setMatrixView] = useState<MatrixView>('execution');
  const [drilldown, setDrilldown] = useState<{
    modelId: string;
    modelLabel: string;
    taskId: string;
    view: MatrixView;
  } | null>(null);

  const aggregates = useMemo<ModelAggregate[]>(() => {
    const buckets = new Map<string, number[]>();
    for (const ep of index.episodes) {
      const k = `${ep.model_id}|${ep.protocol}|${ep.task_id}`;
      const arr = buckets.get(k);
      if (arr) arr.push(ep.score);
      else buckets.set(k, [ep.score]);
    }
    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    return index.models.map((m) => {
      const perTaskExec: Record<string, number> = {};
      const perTaskQa: Record<string, number> = {};
      for (const task of TASKS) {
        perTaskExec[task.id] = mean(buckets.get(`${m.id}|execution|${task.id}`) ?? []);
        perTaskQa[task.id] = mean(buckets.get(`${m.id}|qa|${task.id}`) ?? []);
      }

      const execCat = {} as Record<CategoryId | 'mean', number>;
      const qaCat = {} as Record<CategoryId | 'mean', number>;
      const gapCat = {} as Record<CategoryId | 'mean', number>;
      for (const cat of CATEGORIES) {
        execCat[cat.id] = mean(cat.tasks.map((tid) => perTaskExec[tid]));
        qaCat[cat.id] = mean(cat.tasks.map((tid) => perTaskQa[tid]));
        gapCat[cat.id] = qaCat[cat.id] - execCat[cat.id];
      }
      execCat.mean = mean(CATEGORIES.map((c) => execCat[c.id]));
      qaCat.mean = mean(CATEGORIES.map((c) => qaCat[c.id]));
      gapCat.mean = qaCat.mean - execCat.mean;

      return {
        modelId: m.id,
        label: m.label,
        short: m.short,
        effort: m.effort,
        family: m.family,
        exec: execCat,
        qa: qaCat,
        gap: gapCat,
        perTaskExec,
        perTaskQa,
      };
    });
  }, [index]);

  const frontierSorted = useMemo(
    () =>
      [...aggregates].sort((a, b) =>
        rankBy === 'execution' ? b.exec.mean - a.exec.mean : b.qa.mean - a.qa.mean,
      ),
    [aggregates, rankBy],
  );

  // Rank map based on current rankBy (overall mean across all 9 models)
  const overallRankByModel = useMemo(() => {
    const map = new Map<string, number>();
    frontierSorted.forEach((row, i) => map.set(row.modelId, i + 1));
    return map;
  }, [frontierSorted]);

  const filteredTableRows = useMemo(() => {
    const pick = (row: ModelAggregate) => (rankBy === 'execution' ? row.exec : row.qa);
    const factor = sortDir === 'asc' ? 1 : -1;
    return aggregates
      .filter((row) => {
        if (effortFilter !== 'all' && row.effort !== effortFilter) return false;
        if (familyFilter !== 'all' && row.family !== familyFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'model') return factor * COLLATOR.compare(a.label, b.label);
        return factor * (pick(a)[sortKey] - pick(b)[sortKey]);
      });
  }, [aggregates, effortFilter, familyFilter, rankBy, sortKey, sortDir]);

  const colMax = useMemo(() => {
    const pick = (row: ModelAggregate) => (rankBy === 'execution' ? row.exec : row.qa);
    const keys: Array<CategoryId | 'mean'> = ['GAS', 'DDC', 'ARC', 'SPF', 'CGM', 'mean'];
    const result: Record<string, number> = {};
    for (const k of keys) {
      result[k] = Math.max(...aggregates.map((r) => Number(pick(r)[k].toFixed(2))));
    }
    return result;
  }, [aggregates, rankBy]);

  const handleSort = (key: SortKey, label: string) => {
    const nextDir: 'asc' | 'desc' =
      sortKey === key ? (sortDir === 'desc' ? 'asc' : 'desc') : key === 'model' ? 'asc' : 'desc';
    setSortKey(key);
    setSortDir(nextDir);
    setSortStatus(`Sorted by ${label}, ${nextDir === 'asc' ? 'ascending' : 'descending'}`);
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3 w-3" aria-hidden="true" />
    );
  };

  const drilldownRows = useMemo(() => {
    if (!drilldown) return [];
    const bySeed = new Map<number, { qa?: EpisodeSummary; execution?: EpisodeSummary }>();
    for (const ep of index.episodes) {
      if (ep.model_id !== drilldown.modelId || ep.task_id !== drilldown.taskId) continue;
      const entry = bySeed.get(ep.seed) ?? {};
      entry[ep.protocol] = ep;
      bySeed.set(ep.seed, entry);
    }
    return Array.from(bySeed.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([seed, pair]) => ({ seed, qa: pair.qa, execution: pair.execution }));
  }, [drilldown, index.episodes]);

  const families = useMemo(
    () => Array.from(new Set(index.models.map((m) => m.family))),
    [index.models],
  );

  const metricCols: Array<{ key: CategoryId | 'mean'; label: string }> = [
    { key: 'mean', label: 'Mean' },
    { key: 'GAS', label: 'GAS' },
    { key: 'DDC', label: 'DDC' },
    { key: 'ARC', label: 'ARC' },
    { key: 'SPF', label: 'SPF' },
    { key: 'CGM', label: 'CGM' },
  ];

  const tocItems = [
    { id: 'lb-frontier', num: '01', en: 'Metric Frontier', zh: '能力前沿图' },
    { id: 'lb-main', num: '02', en: 'Main Leaderboard', zh: '主评测榜单' },
    { id: 'lb-matrix', num: '03', en: 'Per-Task Details', zh: '20 任务热力图' },
    { id: 'lb-cross', num: '04', en: 'Cross-Platform', zh: '跨平台评测' },
  ];

  const topExec = useMemo(
    () => [...aggregates].sort((a, b) => b.exec.mean - a.exec.mean)[0],
    [aggregates],
  );
  const topQa = useMemo(
    () => [...aggregates].sort((a, b) => b.qa.mean - a.qa.mean)[0],
    [aggregates],
  );
  const avgGap = useMemo(
    () =>
      aggregates.length
        ? aggregates.reduce((acc, r) => acc + r.gap.mean, 0) / aggregates.length
        : 0,
    [aggregates],
  );

  return (
    <div className="mx-auto max-w-[1380px] px-5 py-10 sm:px-8 lg:px-10">
      <div role="status" className="sr-only-status">
        {sortStatus}
      </div>

      <div className="flex items-start gap-8">
        {/* Left Sticky On-This-Page Rail */}
        <aside className="sticky top-24 hidden w-40 shrink-0 xl:block" aria-label="On this page">
          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-muted)' }}
          >
            {lang === 'en' ? 'On this page' : '本页目录'}
          </div>
          <nav className="space-y-1">
            {tocItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="flex w-full items-baseline gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--ink-secondary)' }}
              >
                <span className="font-mono-metric text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  {item.num}
                </span>
                <span className="font-medium">{lang === 'en' ? item.en : item.zh}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Column */}
        <div className="min-w-0 flex-1 space-y-10">
          {/* Clean Executive Leaderboard Header + Color-Accented Key Metrics */}
          <header className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5">
                <div
                  className="font-mono-metric text-xs font-medium uppercase tracking-widest"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  FRANKA PANDA · 20 TASKS × 10 SEEDS × 2 PROTOCOLS
                </div>
                <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {tr.lbTitle}
                </h1>
              </div>
              <a
                href="#/explorer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold no-underline transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: 'var(--line-strong)',
                  background: 'var(--bg-surface)',
                  color: 'var(--ink-primary)',
                }}
              >
                <span>{lang === 'en' ? 'Inspect 3,600 Trajectories' : '查看 3,600 条轨迹'}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>

            {/* 4 Harmonized Color-Accented Summary Cards */}
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="paper-plate px-4 py-3.5">
                <dt className="text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                  {lang === 'en' ? 'Top Execution Mean' : '执行最高均分'}
                </dt>
                <dd className="mt-1 flex items-baseline justify-between gap-2">
                  <span
                    className="tabular-nums-clean text-2xl font-bold tracking-tight"
                    style={{ color: 'var(--kpi-1)' }}
                  >
                    {topExec?.exec.mean.toFixed(2)}
                  </span>
                  {topExec ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--ink-secondary)' }}>
                      <ProviderGlyph family={topExec.family} size={14} />
                      <span>{topExec.short}</span>
                    </span>
                  ) : null}
                </dd>
              </div>

              <div className="paper-plate px-4 py-3.5">
                <dt className="text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                  {lang === 'en' ? 'Top Metric QA Mean' : '度量问答最高均分'}
                </dt>
                <dd className="mt-1 flex items-baseline justify-between gap-2">
                  <span
                    className="tabular-nums-clean text-2xl font-bold tracking-tight"
                    style={{ color: 'var(--kpi-3)' }}
                  >
                    {topQa?.qa.mean.toFixed(2)}
                  </span>
                  {topQa ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--ink-secondary)' }}>
                      <ProviderGlyph family={topQa.family} size={14} />
                      <span>{topQa.short}</span>
                    </span>
                  ) : null}
                </dd>
              </div>

              <div className="paper-plate px-4 py-3.5">
                <dt className="text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                  {lang === 'en' ? 'Avg QA − Exec Gap' : '平均理解—执行落差'}
                </dt>
                <dd className="mt-1 flex items-baseline justify-between gap-2">
                  <span
                    className="tabular-nums-clean text-2xl font-bold tracking-tight"
                    style={{ color: 'var(--kpi-4)' }}
                  >
                    +{avgGap.toFixed(1)}
                  </span>
                  <span className="font-mono-metric text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    pts (9 VLMs)
                  </span>
                </dd>
              </div>

              <div className="paper-plate px-4 py-3.5">
                <dt className="text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                  {lang === 'en' ? 'QA vs. Exec Correlation' : 'QA 与执行相关性'}
                </dt>
                <dd className="mt-1 flex items-baseline justify-between gap-2">
                  <span
                    className="tabular-nums-clean text-2xl font-bold tracking-tight"
                    style={{ color: 'var(--kpi-2)' }}
                  >
                    r = 0.92
                  </span>
                  <span className="font-mono-metric text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    ρ = 0.87
                  </span>
                </dd>
              </div>
            </dl>
          </header>

          {/* 01 · Flagship Full-Width Frontier Visualization Card */}
          <section id="lb-frontier" className="scroll-mt-24 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 tabIndex={-1} className="text-lg font-bold tracking-tight focus:outline-none">
                {lang === 'en' ? 'RoboMetriX Frontier' : 'RoboMetriX 能力前沿'}
              </h2>

              <div
                className="inline-flex rounded-full p-0.5 text-xs"
                style={{ background: 'var(--bg-subtle)' }}
                role="group"
                aria-label="Chart mode"
              >
                <button
                  type="button"
                  aria-pressed={chartMode === 'frontier'}
                  onClick={() => setChartMode('frontier')}
                  className="rounded-full px-3 py-1 font-semibold transition-colors"
                  style={{
                    background: chartMode === 'frontier' ? 'var(--bg-surface)' : 'transparent',
                    color: chartMode === 'frontier' ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                    boxShadow: chartMode === 'frontier' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {lang === 'en' ? 'Gap Frontier' : '鸿沟前沿图'}
                </button>
                <button
                  type="button"
                  aria-pressed={chartMode === 'scatter'}
                  onClick={() => setChartMode('scatter')}
                  className="rounded-full px-3 py-1 font-semibold transition-colors"
                  style={{
                    background: chartMode === 'scatter' ? 'var(--bg-surface)' : 'transparent',
                    color: chartMode === 'scatter' ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                    boxShadow: chartMode === 'scatter' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {lang === 'en' ? 'Correlation (r = 0.92)' : '相关性散点 (r = 0.92)'}
                </button>
              </div>
            </div>

            <div className="rd-card p-5 sm:p-7">
              {chartMode === 'frontier' ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1a73e8]" />
                        <span>{lang === 'en' ? 'Metric-Constrained Execution' : '度量约束执行 (Exec)'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#d97706]"
                          style={{ backgroundColor: 'var(--bg-surface)' }}
                        />
                        <span>{lang === 'en' ? 'Embodied Metric QA' : '具身度量问答 (QA)'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}>
                        <span className="inline-block h-1.5 w-6 rounded-full bg-gradient-to-r from-[#1a73e8]/45 to-[#d97706]/45" />
                        <span>{lang === 'en' ? 'Understanding–Execution Gap' : '理解—执行鸿沟'}</span>
                      </span>
                    </div>
                    <span className="font-mono-metric text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                      Franka Panda · 3,600 Trajectories
                    </span>
                  </div>

                  {/* Full-width Dumbbell / Gap Frontier Chart */}
                  <div className="space-y-2.5 pt-2">
                    {/* Scale header */}
                    <div className="grid grid-cols-[190px_1fr_72px] items-center gap-4 text-[11px] sm:grid-cols-[220px_1fr_84px]">
                      <span />
                      <div className="font-mono-metric flex justify-between" style={{ color: 'var(--ink-muted)' }}>
                        <span>0</span>
                        <span>20</span>
                        <span>40</span>
                        <span>60</span>
                        <span>80</span>
                        <span>100</span>
                      </div>
                      <span className="font-mono-metric text-right" style={{ color: 'var(--ink-muted)' }}>
                        QA − Exec
                      </span>
                    </div>

                    {frontierSorted.map((row, idx) => {
                      const spec = getFamilySpec(row.family);
                      const execPct = Math.max(0, Math.min(100, row.exec.mean));
                      const qaPct = Math.max(0, Math.min(100, row.qa.mean));
                      const leftPct = Math.min(execPct, qaPct);
                      const widthPct = Math.abs(qaPct - execPct);
                      const isHovered = hoveredModel === row.modelId;

                      return (
                        <a
                          key={row.modelId}
                          href={buildExplorerHref({ model: row.modelId })}
                          onMouseEnter={() => setHoveredModel(row.modelId)}
                          onMouseLeave={() => setHoveredModel(null)}
                          className="grid grid-cols-[190px_1fr_72px] items-center gap-4 rounded-xl px-2 py-2 no-underline transition-colors sm:grid-cols-[220px_1fr_84px]"
                          style={{
                            background: isHovered ? 'var(--bg-subtle)' : 'transparent',
                            color: 'var(--ink-primary)',
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="font-mono-metric w-4 text-right text-[11px]"
                              style={{ color: 'var(--ink-muted)' }}
                            >
                              {idx + 1}
                            </span>
                            <ProviderGlyph family={row.family} size={22} />
                            <span className="truncate text-xs font-semibold sm:text-sm">
                              {row.label}
                            </span>
                          </div>

                          <div className="relative h-7">
                            {/* Grid ticks */}
                            {[0, 20, 40, 60, 80, 100].map((tick) => (
                              <span
                                key={tick}
                                className="pointer-events-none absolute inset-y-0 w-px"
                                style={{
                                  left: `${tick}%`,
                                  background: 'var(--line-subtle)',
                                }}
                              />
                            ))}

                            {/* Base track */}
                            <div
                              className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
                              style={{ background: 'var(--bg-subtle)' }}
                            />

                            {/* Gap connecting ribbon */}
                            <div
                              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
                              style={{
                                left: `${leftPct}%`,
                                width: `${Math.max(widthPct, 0.5)}%`,
                                background: `linear-gradient(90deg, ${spec.dot}55, rgba(217, 119, 6, 0.35))`,
                              }}
                            />

                            {/* Execution dot + label */}
                            <div
                              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                              style={{ left: `${execPct}%` }}
                            >
                              <span
                                className="block h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: '#1a73e8' }}
                              />
                              <span
                                className="font-mono-metric absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold"
                                style={{ color: 'var(--accent-primary)' }}
                              >
                                {row.exec.mean.toFixed(1)}
                              </span>
                            </div>

                            {/* QA ring + label */}
                            <div
                              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                              style={{ left: `${qaPct}%` }}
                            >
                              <span
                                className="block h-3.5 w-3.5 rounded-full border-[2.5px] shadow-sm"
                                style={{
                                  borderColor: '#d97706',
                                  backgroundColor: 'var(--bg-surface)',
                                }}
                              />
                              <span
                                className="font-mono-metric absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold"
                                style={{ color: 'var(--accent-amber)' }}
                              >
                                {row.qa.mean.toFixed(1)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className="font-mono-metric inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                background: 'rgba(245, 158, 11, 0.12)',
                                color: 'var(--accent-amber)',
                              }}
                            >
                              +{row.gap.mean.toFixed(1)}
                            </span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Full-width Publication-Grade Correlation Scatter (Zoomed Y 0–65 + Collision-Free Leader Callouts) */
                (() => {
                  const X0 = 72;
                  const X_SPAN = 820;
                  const X_MAX = 95;
                  const Y0 = 336;
                  const Y_SPAN = 290;
                  const Y_MAX = 65;
                  const sx = (qa: number) => X0 + (qa / X_MAX) * X_SPAN;
                  const sy = (ex: number) => Y0 - (ex / Y_MAX) * Y_SPAN;

                  // Hand-tuned collision-free callout positions for all 9 frontier VLMs
                  const calloutMap: Record<
                    string,
                    { lx: number; ly: number; anchor: 'start' | 'end'; leader?: boolean }
                  > = {
                    'gpt-6-luna': { lx: 186, ly: 256, anchor: 'end', leader: true },
                    'deepseek-flash': { lx: 278, ly: 196, anchor: 'end', leader: true },
                    'gemini-4-hydrogen': { lx: 356, ly: 138, anchor: 'end', leader: true },
                    'gpt-6.1-terra': { lx: 444, ly: 162, anchor: 'start', leader: true },
                    'claude-opus-5-5': { lx: 562, ly: 222, anchor: 'start', leader: true },
                    'kimi-k3.1-pro': { lx: 562, ly: 274, anchor: 'start', leader: true },
                    'qwen3.8-max': { lx: 562, ly: 322, anchor: 'start', leader: true },
                    'gpt-6.1-sol': { lx: 730, ly: 188, anchor: 'start', leader: false },
                    'gpt-6-astra': { lx: 774, ly: 94, anchor: 'end', leader: false },
                  };

                  // Dynamic OLS regression line across the 9 models
                  const n = aggregates.length || 1;
                  const mx = aggregates.reduce((a, r) => a + r.qa.mean, 0) / n;
                  const my = aggregates.reduce((a, r) => a + r.exec.mean, 0) / n;
                  const num = aggregates.reduce((a, r) => a + (r.qa.mean - mx) * (r.exec.mean - my), 0);
                  const den = aggregates.reduce((a, r) => a + (r.qa.mean - mx) ** 2, 0) || 1;
                  const slope = num / den;
                  const intercept = my - slope * mx;
                  const regX1 = Math.max(0, -intercept / slope);
                  const regX2 = 88;
                  const regY2 = Math.min(Y_MAX, slope * regX2 + intercept);

                  return (
                    <svg
                      viewBox="0 0 940 392"
                      className="w-full"
                      role="img"
                      aria-label="Correlation scatter between Embodied Metric QA and Metric-Constrained Execution across 9 VLMs"
                    >
                      {/* Horizontal grid & Y ticks (0–60) */}
                      {[0, 10, 20, 30, 40, 50, 60].map((tick) => {
                        const y = sy(tick);
                        return (
                          <g key={`y-${tick}`}>
                            <line
                              x1={X0}
                              y1={y}
                              x2={X0 + X_SPAN}
                              y2={y}
                              stroke="var(--line-subtle)"
                            />
                            <text
                              x={X0 - 12}
                              y={y + 4}
                              textAnchor="end"
                              fontSize="11"
                              fill="var(--ink-muted)"
                              className="font-mono-metric"
                            >
                              {tick}
                            </text>
                          </g>
                        );
                      })}

                      {/* Vertical grid & X ticks (0–90) */}
                      {[0, 20, 40, 60, 80].map((tick) => {
                        const x = sx(tick);
                        return (
                          <g key={`x-${tick}`}>
                            <line
                              x1={x}
                              y1={Y0 - Y_SPAN}
                              x2={x}
                              y2={Y0}
                              stroke="var(--line-subtle)"
                            />
                            <text
                              x={x}
                              y={Y0 + 20}
                              textAnchor="middle"
                              fontSize="11"
                              fill="var(--ink-muted)"
                              className="font-mono-metric"
                            >
                              {tick}
                            </text>
                          </g>
                        );
                      })}

                      {/* QA = Execution parity ceiling (0,0) -> (65,65) */}
                      <line
                        x1={sx(0)}
                        y1={sy(0)}
                        x2={sx(Y_MAX)}
                        y2={sy(Y_MAX)}
                        stroke="#d97706"
                        strokeDasharray="6 5"
                        strokeOpacity={0.55}
                      />
                      <text
                        x={sx(Y_MAX) + 8}
                        y={sy(Y_MAX) + 12}
                        fontSize="11"
                        fill="var(--accent-amber)"
                        className="font-mono-metric"
                      >
                        QA = Execution (parity)
                      </text>

                      {/* OLS Regression Trendline */}
                      <line
                        x1={sx(regX1)}
                        y1={sy(Math.max(0, slope * regX1 + intercept))}
                        x2={sx(regX2)}
                        y2={sy(regY2)}
                        stroke="var(--accent-primary)"
                        strokeWidth={1.5}
                        strokeDasharray="3 4"
                        strokeOpacity={0.45}
                      />

                      {/* Correlation badge */}
                      <text
                        x={X0 + 16}
                        y={Y0 - Y_SPAN + 20}
                        fontSize="12"
                        fontWeight="600"
                        fill="var(--accent-primary)"
                        className="font-mono-metric"
                      >
                        Pearson r = 0.92 · Spearman ρ = 0.87
                      </text>

                      {/* Points + Leader Lines + Collision-Free Labels */}
                      {aggregates.map((row) => {
                        const cx = sx(row.qa.mean);
                        const cy = sy(row.exec.mean);
                        const spec = getFamilySpec(row.family);
                        const active = hoveredModel === row.modelId;
                        const cfg = calloutMap[row.modelId] ?? {
                          lx: cx + 14,
                          ly: cy - 4,
                          anchor: 'start' as const,
                          leader: false,
                        };
                        const lineEndX = cfg.anchor === 'end' ? cfg.lx + 5 : cfg.lx - 5;
                        const lineEndY = cfg.ly + 2;

                        return (
                          <a
                            key={row.modelId}
                            href={buildExplorerHref({ model: row.modelId })}
                            onMouseEnter={() => setHoveredModel(row.modelId)}
                            onMouseLeave={() => setHoveredModel(null)}
                          >
                            {cfg.leader ? (
                              <line
                                x1={cx}
                                y1={cy}
                                x2={lineEndX}
                                y2={lineEndY}
                                stroke={active ? spec.dot : 'var(--line-strong)'}
                                strokeWidth={active ? 1.5 : 1}
                                strokeOpacity={active ? 0.9 : 0.65}
                              />
                            ) : null}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={active ? 10 : 7.5}
                              fill={spec.dot}
                              stroke="var(--bg-surface)"
                              strokeWidth={2.5}
                            />
                            <text
                              x={cfg.lx}
                              y={cfg.ly}
                              textAnchor={cfg.anchor}
                              fontSize="12"
                              fontWeight={active ? '700' : '600'}
                              fill="var(--ink-primary)"
                            >
                              {row.label}
                            </text>
                            <text
                              x={cfg.lx}
                              y={cfg.ly + 14}
                              textAnchor={cfg.anchor}
                              fontSize="10.5"
                              fill="var(--ink-muted)"
                              className="font-mono-metric"
                            >
                              Exec {row.exec.mean.toFixed(1)} · QA {row.qa.mean.toFixed(1)}
                            </text>
                          </a>
                        );
                      })}

                      <text
                        x={X0 + X_SPAN / 2}
                        y={380}
                        textAnchor="middle"
                        fontSize="12"
                        fill="var(--ink-secondary)"
                      >
                        Embodied Metric QA Score (0–100)
                      </text>
                      <text
                        x={20}
                        y={Y0 - Y_SPAN / 2}
                        textAnchor="middle"
                        fontSize="12"
                        fill="var(--ink-secondary)"
                        transform={`rotate(-90 20 ${Y0 - Y_SPAN / 2})`}
                      >
                        Metric-Constrained Execution Score (0–65)
                      </text>
                    </svg>
                  );
                })()
              )}
            </div>
          </section>

          {/* 02 · Full-Width RoboDojo-Style Main Leaderboard Table Card */}
          <section id="lb-main" className="scroll-mt-24">
            <div className="rd-card overflow-hidden">
              {/* Card Header + Inline Controls */}
              <div
                className="space-y-4 border-b px-6 py-5"
                style={{ borderColor: 'var(--line-subtle)' }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 tabIndex={-1} className="text-base font-bold focus:outline-none sm:text-lg">
                      {lang === 'en'
                        ? `RoboMetriX Main Leaderboard (${rankBy === 'execution' ? 'Execution' : 'Metric QA'})`
                        : `RoboMetriX 主评测榜单（按 ${rankBy === 'execution' ? 'Execution' : 'Metric QA'} 排名）`}
                    </h2>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--ink-muted)' }}>
                      {displayMode === 'paired'
                        ? lang === 'en'
                          ? 'Cells always show Execution / Metric QA (ranked protocol highlighted) · Category-balanced mean across GAS, DDC, ARC, SPF, CGM'
                          : '单元格统一以 Execution / Metric QA 顺序展示（当前排序协议高亮）· 五大任务类别等权平均'
                        : lang === 'en'
                          ? 'Category-balanced scores across GAS (4), DDC (6), ARC (3), SPF (5), CGM (2)'
                          : '五大类别等权均分：GAS (4)、DDC (6)、ARC (3)、SPF (5)、CGM (2)'}
                    </p>
                  </div>
                  <span className="font-mono-metric text-xs" style={{ color: 'var(--ink-muted)' }}>
                    Franka Panda · 20 Tasks × 10 Seeds
                  </span>
                </div>

                {/* Inline RoboDojo-style Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      RANK BY
                    </span>
                    <div
                      className="inline-flex rounded-full p-0.5"
                      style={{ background: 'var(--bg-subtle)' }}
                      role="group"
                      aria-label="Rank by protocol"
                    >
                      {(
                        [
                          { id: 'execution', label: 'Execution' },
                          { id: 'qa', label: 'Metric QA' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={rankBy === opt.id}
                          onClick={() => setRankBy(opt.id)}
                          className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                          style={{
                            background: rankBy === opt.id ? 'var(--accent-soft)' : 'transparent',
                            color: rankBy === opt.id ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      DISPLAY
                    </span>
                    <div
                      className="inline-flex rounded-full p-0.5"
                      style={{ background: 'var(--bg-subtle)' }}
                      role="group"
                      aria-label="Display mode"
                    >
                      {(
                        [
                          { id: 'paired', label: 'Exec / QA' },
                          { id: 'single', label: 'Single' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={displayMode === opt.id}
                          onClick={() => setDisplayMode(opt.id)}
                          className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                          style={{
                            background: displayMode === opt.id ? 'var(--accent-soft)' : 'transparent',
                            color: displayMode === opt.id ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      EFFORT
                    </span>
                    <div
                      className="inline-flex rounded-full p-0.5"
                      style={{ background: 'var(--bg-subtle)' }}
                      role="group"
                      aria-label="Filter by reasoning effort"
                    >
                      {(['all', 'medium', 'high'] as const).map((eff) => (
                        <button
                          key={eff}
                          type="button"
                          aria-pressed={effortFilter === eff}
                          onClick={() => setEffortFilter(eff)}
                          className="rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors"
                          style={{
                            background: effortFilter === eff ? 'var(--accent-soft)' : 'transparent',
                            color: effortFilter === eff ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                          }}
                        >
                          {eff}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      FAMILY
                    </span>
                    <select
                      aria-label="Filter by model family"
                      value={familyFilter}
                      onChange={(e) => setFamilyFilter(e.target.value)}
                      className="h-7 rounded-full border px-3 text-xs font-medium"
                      style={{
                        borderColor: 'var(--line-subtle)',
                        background: 'var(--bg-surface)',
                        color: 'var(--ink-primary)',
                      }}
                    >
                      <option value="all">All</option>
                      {families.map((fam) => (
                        <option key={fam} value={fam}>
                          {fam}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Clean Full-Width Semantic Sortable Table */}
              <div tabIndex={0} role="region" aria-labelledby="main-lb-caption" className="table-wrapper">
                <table className="metric-table">
                  <caption id="main-lb-caption" className="sr-only-status">
                    RoboMetriX main leaderboard across 9 frontier VLMs
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="w-14 text-center">
                        Rank
                      </th>
                      <th
                        scope="col"
                        aria-sort={
                          sortKey === 'model'
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <button type="button" onClick={() => handleSort('model', 'Model')}>
                          <span>Model</span>
                          {renderSortIcon('model')}
                        </button>
                      </th>
                      <th scope="col">Family</th>
                      <th scope="col">Effort</th>
                      {metricCols.map((col) => (
                        <th
                          key={col.key}
                          scope="col"
                          aria-sort={
                            sortKey === col.key
                              ? sortDir === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : undefined
                          }
                        >
                          <button type="button" onClick={() => handleSort(col.key, col.label)}>
                            <span>{col.label}</span>
                            {renderSortIcon(col.key)}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTableRows.map((row) => {
                      const rank = overallRankByModel.get(row.modelId) ?? 0;
                      const rankedMetric = rankBy === 'execution' ? row.exec : row.qa;
                      const highlighted = hoveredModel === row.modelId;

                      return (
                        <tr
                          key={row.modelId}
                          onMouseEnter={() => setHoveredModel(row.modelId)}
                          onMouseLeave={() => setHoveredModel(null)}
                          style={highlighted ? { background: 'var(--bg-subtle)' } : undefined}
                        >
                          <td className="text-center">
                            <RankBadge rank={rank} />
                          </td>
                          <th scope="row" className="whitespace-nowrap">
                            <a
                              href={buildExplorerHref({
                                model: row.modelId,
                                protocol: rankBy,
                              })}
                              className="inline-flex items-center gap-2.5 no-underline hover:underline"
                              style={{ color: 'var(--ink-primary)' }}
                            >
                              <ProviderGlyph family={row.family} size={22} />
                              <span>{row.label}</span>
                            </a>
                          </th>
                          <td>
                            <FamilyPill family={row.family} />
                          </td>
                          <td>
                            <span
                              className="font-mono-metric rounded-md px-2 py-0.5 text-[11px]"
                              style={{ background: 'var(--bg-subtle)', color: 'var(--ink-secondary)' }}
                            >
                              {row.effort}
                            </span>
                          </td>
                          {metricCols.map((col) => {
                            const execVal = row.exec[col.key];
                            const qaVal = row.qa[col.key];
                            const rVal = rankedMetric[col.key];
                            const isBest = Number(rVal.toFixed(2)) === colMax[col.key];
                            const execMeanVal = row.exec.mean;
                            const qaMeanVal = row.qa.mean;
                            return (
                              <td
                                key={col.key}
                                className="font-mono-metric whitespace-nowrap text-xs"
                              >
                                <div className={col.key === 'mean' ? 'min-w-[104px] space-y-1' : undefined}>
                                  {displayMode === 'paired' ? (
                                    <div>
                                      <span
                                        className={
                                          rankBy === 'execution'
                                            ? col.key === 'mean' || isBest
                                              ? 'font-bold'
                                              : 'font-medium'
                                            : undefined
                                        }
                                        style={
                                          rankBy === 'execution'
                                            ? isBest
                                              ? { color: 'var(--accent-primary)' }
                                              : { color: 'var(--ink-primary)' }
                                            : { color: 'var(--ink-muted)' }
                                        }
                                      >
                                        {execVal.toFixed(2)}
                                      </span>
                                      <span style={{ color: 'var(--ink-muted)' }}> / </span>
                                      <span
                                        className={
                                          rankBy === 'qa'
                                            ? col.key === 'mean' || isBest
                                              ? 'font-bold'
                                              : 'font-medium'
                                            : undefined
                                        }
                                        style={
                                          rankBy === 'qa'
                                            ? isBest
                                              ? { color: 'var(--accent-primary)' }
                                              : { color: 'var(--ink-primary)' }
                                            : { color: 'var(--ink-muted)' }
                                        }
                                      >
                                        {qaVal.toFixed(2)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div>
                                      <span
                                        className={col.key === 'mean' || isBest ? 'font-bold' : 'font-medium'}
                                        style={
                                          isBest ? { color: 'var(--accent-primary)' } : undefined
                                        }
                                      >
                                        {rVal.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                  {col.key === 'mean' ? (
                                    <div
                                      className="metric-ruler-ticks relative h-1.5 w-full overflow-hidden rounded-full"
                                      style={{ background: 'var(--bg-subtle)' }}
                                      title={`Execution ${execMeanVal.toFixed(2)} vs. Metric QA ${qaMeanVal.toFixed(2)}`}
                                    >
                                      <div
                                        className="absolute inset-y-0 left-0 rounded-full"
                                        style={{
                                          width: `${Math.min(100, qaMeanVal)}%`,
                                          background: 'rgba(217, 119, 6, 0.34)',
                                        }}
                                      />
                                      <div
                                        className="absolute inset-y-0 left-0 rounded-full"
                                        style={{
                                          width: `${Math.min(100, execMeanVal)}%`,
                                          background: 'var(--accent-primary)',
                                        }}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 03 · Per-Task Heatmap Matrix Card */}
          <section id="lb-matrix" className="scroll-mt-24">
            <div className="rd-card overflow-hidden">
              <div
                className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5"
                style={{ borderColor: 'var(--line-subtle)' }}
              >
                <div>
                  <h2 tabIndex={-1} className="text-base font-bold focus:outline-none sm:text-lg">
                    {lang === 'en' ? 'Per-Task Details (20 Tasks × 9 VLMs)' : '逐任务明细热力图（20 任务 × 9 模型）'}
                  </h2>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {lang === 'en'
                      ? 'Click any cell to inspect all 10 seeds and open trajectories directly in Playback Studio.'
                      : '点击任意单元格，查看该模型在该任务下全部 10 个种子的成绩并直接打开回放。'}
                  </p>
                </div>

                <div
                  className="inline-flex rounded-full p-0.5"
                  style={{ background: 'var(--bg-subtle)' }}
                  role="group"
                  aria-label="Heatmap metric view"
                >
                  {[
                    { key: 'execution' as const, label: tr.execution },
                    { key: 'qa' as const, label: tr.qa },
                    { key: 'gap' as const, label: tr.gapMode },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      aria-pressed={matrixView === opt.key}
                      onClick={() => setMatrixView(opt.key)}
                      className="rounded-full px-3.5 py-1 text-xs font-semibold transition-colors"
                      style={{
                        background: matrixView === opt.key ? 'var(--accent-soft)' : 'transparent',
                        color: matrixView === opt.key ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div tabIndex={0} role="region" aria-labelledby="matrix-caption" className="table-wrapper">
                <table className="metric-table matrix-table">
                  <caption id="matrix-caption" className="sr-only-status">
                    Per-task heatmap across 20 tasks and 9 frontier VLMs
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Cat.</th>
                      <th scope="col">Task</th>
                      {frontierSorted.map((m) => (
                        <th key={m.modelId} scope="col" className="text-center">
                          <span className="inline-flex flex-col items-center gap-1">
                            <ProviderGlyph family={m.family} size={15} />
                            <span>{m.short}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TASKS.map((task) => (
                      <tr key={task.id}>
                        <td
                          className="font-mono-metric text-[11px] font-semibold"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          {task.category}
                        </td>
                        <th scope="row" className="whitespace-nowrap">
                          {lang === 'en' ? task.nameEn : task.nameZh}
                        </th>
                        {frontierSorted.map((m) => {
                          const val =
                            matrixView === 'execution'
                              ? m.perTaskExec[task.id]
                              : matrixView === 'qa'
                                ? m.perTaskQa[task.id]
                                : m.perTaskQa[task.id] - m.perTaskExec[task.id];
                          const { bg, fg } = heatCellColors(val, matrixView === 'gap');
                          return (
                            <td key={m.modelId} className="text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setDrilldown({
                                    modelId: m.modelId,
                                    modelLabel: m.label,
                                    taskId: task.id,
                                    view: matrixView,
                                  })
                                }
                                className="font-mono-metric w-full min-w-[48px] rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-transform hover:scale-[1.04]"
                                style={{ backgroundColor: bg, color: fg }}
                                title={`${m.label} · ${task.nameEn}: ${val.toFixed(2)}`}
                              >
                                {matrixView === 'gap' && val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 04 · Cross-Platform Execution Card */}
          <section id="lb-cross" className="scroll-mt-24">
            <div className="rd-card overflow-hidden">
              <div className="border-b px-6 py-5" style={{ borderColor: 'var(--line-subtle)' }}>
                <h2 tabIndex={-1} className="text-base font-bold focus:outline-none sm:text-lg">
                  {lang === 'en' ? 'Cross-Platform Execution (GPT-6 Astra)' : '跨机器人平台执行评测（GPT-6 Astra）'}
                </h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--ink-muted)' }}>
                  {lang === 'en'
                    ? '20 tasks × 10 seeds (200 episodes per robot) under the unified Cartesian tool-call interface.'
                    : '统一末端工具调用接口下，在三种不同自由度与夹爪构型的机器人上各评测 200 回合。'}
                </p>
              </div>
              <div tabIndex={0} role="region" aria-labelledby="cross-caption" className="table-wrapper">
                <table className="metric-table">
                  <caption id="cross-caption" className="sr-only-status">
                    Cross-platform execution scores for GPT-6 Astra
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Robot Platform</th>
                      <th scope="col">DoF</th>
                      <th scope="col">Aperture</th>
                      <th scope="col">Mean</th>
                      <th scope="col">GAS</th>
                      <th scope="col">DDC</th>
                      <th scope="col">ARC</th>
                      <th scope="col">SPF</th>
                      <th scope="col">CGM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CROSS_PLATFORM_RESULTS.map((r, i) => (
                      <tr key={r.robot}>
                        <th scope="row">
                          <span className="inline-flex items-center gap-2.5">
                            <RankBadge rank={i + 1} />
                            <span>{r.robot}</span>
                          </span>
                        </th>
                        <td className="font-mono-metric text-xs">{r.dof}</td>
                        <td className="font-mono-metric text-xs">{r.aperture}</td>
                        <td
                          className="font-mono-metric text-xs font-bold"
                          style={{ color: 'var(--accent-primary)' }}
                        >
                          {r.Mean.toFixed(2)}
                        </td>
                        <td className="font-mono-metric text-xs">{r.GAS.toFixed(2)}</td>
                        <td className="font-mono-metric text-xs">{r.DDC.toFixed(2)}</td>
                        <td className="font-mono-metric text-xs">{r.ARC.toFixed(2)}</td>
                        <td className="font-mono-metric text-xs">{r.SPF.toFixed(2)}</td>
                        <td className="font-mono-metric text-xs">{r.CGM.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Heatmap Cell 10-Seed Drilldown Modal */}
      <ModalDialog
        open={drilldown !== null}
        title={
          drilldown
            ? `${drilldown.modelLabel} · ${
                lang === 'en'
                  ? TASK_BY_ID[drilldown.taskId]?.nameEn
                  : TASK_BY_ID[drilldown.taskId]?.nameZh
              }`
            : ''
        }
        subtitle={
          drilldown
            ? `${
                drilldown.view === 'gap'
                  ? 'Paired Gap (QA − Execution)'
                  : drilldown.view === 'qa'
                    ? 'Embodied Metric QA'
                    : 'Metric-Constrained Execution'
              } · Seeds 100–109`
            : undefined
        }
        onClose={() => setDrilldown(null)}
      >
        {drilldown ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {drilldownRows.map(({ seed, qa, execution }) => {
                const isGap = drilldown.view === 'gap';
                const primaryEp = drilldown.view === 'qa' ? qa : execution;
                const gapVal = qa && execution ? qa.score - execution.score : null;
                const studioProto: Protocol = drilldown.view === 'qa' ? 'qa' : 'execution';
                const hasPlayableVideo = isGap
                  ? Boolean((qa?.bundled && qa?.has_video) || (execution?.bundled && execution?.has_video))
                  : Boolean(primaryEp?.bundled && primaryEp?.has_video);

                return (
                  <div
                    key={seed}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3.5"
                    style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-subtle)' }}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-metric text-xs font-semibold">Seed {seed}</span>
                        {hasPlayableVideo ? (
                          <span
                            className="font-mono-metric rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: 'rgba(19, 115, 51, 0.14)',
                              color: 'var(--accent-emerald)',
                            }}
                          >
                            VIDEO
                          </span>
                        ) : null}
                      </div>

                      {isGap ? (
                        <div className="font-mono-metric flex flex-wrap gap-2 text-xs">
                          <span style={{ color: 'var(--accent-amber)' }}>
                            QA {qa?.score.toFixed(1) ?? '—'}
                          </span>
                          <span style={{ color: 'var(--ink-muted)' }}>·</span>
                          <span style={{ color: 'var(--accent-primary)' }}>
                            Exec {execution?.score.toFixed(1) ?? '—'}
                          </span>
                          {gapVal !== null ? (
                            <span className="font-bold">
                              ({gapVal >= 0 ? `+${gapVal.toFixed(1)}` : gapVal.toFixed(1)})
                            </span>
                          ) : null}
                        </div>
                      ) : primaryEp ? (
                        <>
                          <ScoreBar score={primaryEp.score} compact />
                          <div className="font-mono-metric text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                            {primaryEp.rounds} rounds · {primaryEp.steps} steps
                          </div>
                        </>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {isGap ? (
                        <>
                          <a
                            href={buildTrajectoryHref(drilldown.modelId, 'qa', drilldown.taskId, seed)}
                            onClick={() => setDrilldown(null)}
                            className="inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold no-underline transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                            style={{
                              borderColor: 'var(--line-strong)',
                              background: 'var(--bg-surface)',
                              color: 'var(--accent-amber)',
                            }}
                          >
                            <span>QA</span>
                          </a>
                          <a
                            href={buildTrajectoryHref(drilldown.modelId, 'execution', drilldown.taskId, seed)}
                            onClick={() => setDrilldown(null)}
                            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-white no-underline"
                            style={{ background: '#1a73e8' }}
                          >
                            <Play className="h-3 w-3" aria-hidden="true" />
                            <span>Exec</span>
                          </a>
                        </>
                      ) : (
                        <a
                          href={buildTrajectoryHref(
                            drilldown.modelId,
                            studioProto,
                            drilldown.taskId,
                            seed,
                          )}
                          onClick={() => setDrilldown(null)}
                          className="inline-flex h-8 items-center gap-1 rounded-full px-3.5 text-xs font-semibold text-white no-underline"
                          style={{ background: '#1a73e8' }}
                        >
                          <Play className="h-3 w-3" aria-hidden="true" />
                          <span>{lang === 'en' ? 'Inspect' : '查看'}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <a
                href={buildExplorerHref({
                  model: drilldown.modelId,
                  task: drilldown.taskId,
                  protocol: drilldown.view === 'gap' ? undefined : drilldown.view,
                })}
                onClick={() => setDrilldown(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold no-underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                <span>
                  {drilldown.view === 'gap'
                    ? lang === 'en'
                      ? 'Open all 20 paired episodes in Explorer'
                      : '在浏览器中打开全部 20 条配对轨迹'
                    : lang === 'en'
                      ? 'Open all 10 seeds in Explorer'
                      : '在浏览器中打开全部 10 个种子'}
                </span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        ) : null}
      </ModalDialog>
    </div>
  );
}
