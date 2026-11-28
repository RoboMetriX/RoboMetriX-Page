import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Download,
  Play,
  Search,
  Sparkles,
} from 'lucide-react';
import type { CategoryId, EpisodeSummary, IndexPayload, Lang, Protocol } from '../types/benchmark';
import {
  CATEGORIES,
  CURATED_HIGHLIGHTS,
  TASK_BY_ID,
  TASKS,
  type HighlightGroup,
} from '../data/benchmarkMeta';
import { t } from '../lib/i18n';
import {
  episodePosterUrl,
  isEpisodePlayable,
  makeEpisodeId,
  setTaskPosterFallback,
} from '../lib/dataClient';
import { buildExplorerHref, buildTrajectoryHref, navigate } from '../lib/router';
import { scoreBadgeStyle, scoreColor } from '../components/MetricGauge';
import { ProviderGlyph } from '../components/ProviderBadge';

interface ExplorerPageProps {
  index: IndexPayload;
  lang: Lang;
  query: URLSearchParams;
}

type ProtocolView = 'paired' | 'execution' | 'qa';

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[,\r\n"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatPrimaryError(ep: EpisodeSummary): string | null {
  const entries = Object.entries(ep.errors).filter(
    (pair): pair is [string, number] => typeof pair[1] === 'number' && Number.isFinite(pair[1]),
  );
  if (entries.length === 0) return null;
  // Pick the largest absolute error when multiple components exist (bottleneck error)
  const [field, val] = entries.reduce((best, curr) => (curr[1] > best[1] ? curr : best), entries[0]);
  const suffix = field.split('_').pop() ?? 'cm';
  if (suffix === 'cm') {
    if (val > 0 && val < 0.1) return `${(val * 10).toFixed(2)} mm err`;
    return `${val.toFixed(val === 0 ? 0 : 2)} cm err`;
  }
  if (suffix === 'deg') return `${val.toFixed(val === 0 ? 0 : 2)}° err`;
  if (suffix === 'cm2') return `${val.toFixed(1)} cm² err`;
  if (suffix === 'cm3') return `${val.toFixed(1)} cm³ err`;
  return `${val.toFixed(2)} err`;
}

export function ExplorerPage({ index, lang, query }: ExplorerPageProps) {
  const tr = t(lang);

  // URL-synced navigation state
  const rawModel = query.get('model') || '';
  const rawTask = query.get('task') || '';
  const rawProto = query.get('protocol') || '';
  const rawCat = (query.get('category') as CategoryId | '' | null) || '';

  const [taskSearch, setTaskSearch] = useState('');
  const [catFilter, setCatFilter] = useState<CategoryId | 'ALL'>(rawCat || 'ALL');
  const [highlightFilter, setHighlightFilter] = useState<HighlightGroup | 'all'>('all');

  // Pre-index episodes by ID and compute fast lookup maps
  const {
    episodeById,
    modelOverall,
    modelTaskScores,
    modelTaskPlayable,
    taskHasAnyPlayable,
  } = useMemo(() => {
    const byId = new Map<string, EpisodeSummary>();
    const mtBuckets = new Map<string, number[]>();
    const mtPlayable = new Set<string>();
    const tPlayable = new Set<string>();

    for (const ep of index.episodes) {
      byId.set(ep.id, ep);
      const k = `${ep.model_id}|${ep.protocol}|${ep.task_id}`;
      const arr = mtBuckets.get(k);
      if (arr) arr.push(ep.score);
      else mtBuckets.set(k, [ep.score]);
      if (isEpisodePlayable(ep)) {
        mtPlayable.add(`${ep.model_id}|${ep.task_id}`);
        mtPlayable.add(`${ep.model_id}|${ep.protocol}|${ep.task_id}`);
        tPlayable.add(ep.task_id);
      }
    }

    const avg = (arr: number[] | undefined) =>
      arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const taskScores = new Map<string, { exec: number; qa: number }>();
    const overall = new Map<string, { exec: number; qa: number }>();

    for (const m of index.models) {
      const execCats: number[] = [];
      const qaCats: number[] = [];
      for (const cat of CATEGORIES) {
        const execTasks: number[] = [];
        const qaTasks: number[] = [];
        for (const tid of cat.tasks) {
          const e = avg(mtBuckets.get(`${m.id}|execution|${tid}`));
          const q = avg(mtBuckets.get(`${m.id}|qa|${tid}`));
          taskScores.set(`${m.id}|${tid}`, { exec: e, qa: q });
          execTasks.push(e);
          qaTasks.push(q);
        }
        execCats.push(avg(execTasks));
        qaCats.push(avg(qaTasks));
      }
      overall.set(m.id, { exec: avg(execCats), qa: avg(qaCats) });
    }

    return {
      episodeById: byId,
      modelOverall: overall,
      modelTaskScores: taskScores,
      modelTaskPlayable: mtPlayable,
      taskHasAnyPlayable: tPlayable,
    };
  }, [index]);

  // Sort 9 models by overall Execution mean descending (consistent with Leaderboard)
  const orderedModels = useMemo(() => {
    return [...index.models].sort(
      (a, b) => (modelOverall.get(b.id)?.exec ?? 0) - (modelOverall.get(a.id)?.exec ?? 0),
    );
  }, [index.models, modelOverall]);

  // Determine active model & active task cleanly from URL params
  const validModelId = index.models.some((m) => m.id === rawModel) ? rawModel : '';
  const validTaskId = rawTask && TASK_BY_ID[rawTask] ? rawTask : '';

  // Landing on bare `#/explorer` opens Featured Rollouts (16); passing ?task=... or ?model=... opens Task Workspace
  const isFeaturedView = !validTaskId && !validModelId && !rawProto && !rawCat;
  const activeModelId = validModelId || orderedModels[0]?.id || 'gpt-6-astra';
  const activeModel =
    index.models.find((m) => m.id === activeModelId) ?? orderedModels[0];

  // When a model or category is passed without an explicit task, pick its best playable task (or first task in category)
  const fallbackTaskId = useMemo(() => {
    const pool = rawCat ? TASKS.filter((item) => item.category === rawCat) : TASKS;
    const playable = pool.find((item) => modelTaskPlayable.has(`${activeModelId}|${item.id}`));
    return playable?.id ?? pool[0]?.id ?? 'stack_to_height';
  }, [activeModelId, modelTaskPlayable, rawCat]);

  const activeTaskId = isFeaturedView ? '' : validTaskId || fallbackTaskId;
  const activeTaskMeta = activeTaskId ? TASK_BY_ID[activeTaskId] : null;
  const protocolView: ProtocolView =
    rawProto === 'execution' || rawProto === 'qa' ? rawProto : 'paired';

  const selectModel = (modelId: string) => {
    if (isFeaturedView) {
      // Switching to a specific model opens its top playable (or highest-scoring) task directly
      const playableTask = TASKS.find((item) => modelTaskPlayable.has(`${modelId}|${item.id}`));
      navigate(
        buildExplorerHref({
          model: modelId,
          task: playableTask?.id ?? 'stack_to_height',
          protocol: protocolView === 'paired' ? undefined : protocolView,
        }),
      );
    } else {
      navigate(
        buildExplorerHref({
          model: modelId,
          task: activeTaskId,
          protocol: protocolView === 'paired' ? undefined : protocolView,
        }),
      );
    }
  };

  const selectTask = (taskId: string) => {
    navigate(
      buildExplorerHref({
        model: activeModelId,
        task: taskId,
        protocol: protocolView === 'paired' ? undefined : protocolView,
      }),
    );
  };

  const selectProtocol = (next: ProtocolView) => {
    navigate(
      buildExplorerHref({
        model: activeModelId,
        task: activeTaskId,
        protocol: next === 'paired' ? undefined : next,
      }),
    );
  };

  // Sidebar filtered tasks grouped by category
  const visibleCategories = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return CATEGORIES.filter((c) => catFilter === 'ALL' || c.id === catFilter)
      .map((cat) => {
        const items = TASKS.filter((item) => {
          if (item.category !== cat.id) return false;
          if (!q) return true;
          return `${item.nameEn} ${item.nameZh} ${item.id} ${item.category}`
            .toLowerCase()
            .includes(q);
        });
        return { cat, items };
      })
      .filter((group) => group.items.length > 0);
  }, [catFilter, taskSearch]);

  // 10 paired seed rows for the active (model, task) — playable seeds pinned first
  const seedRows = useMemo(() => {
    if (!activeTaskId) return [];
    const rows = Array.from({ length: 10 }, (_, idx) => {
      const seed = 100 + idx;
      const exec = episodeById.get(makeEpisodeId(activeModelId, 'execution', activeTaskId, seed));
      const qa = episodeById.get(makeEpisodeId(activeModelId, 'qa', activeTaskId, seed));
      const hasVideo = Boolean((exec && isEpisodePlayable(exec)) || (qa && isEpisodePlayable(qa)));
      return { seed, exec, qa, hasVideo };
    });
    rows.sort((a, b) => Number(b.hasVideo) - Number(a.hasVideo) || a.seed - b.seed);
    return rows;
  }, [activeModelId, activeTaskId, episodeById]);

  const activeTaskStats = activeTaskId
    ? modelTaskScores.get(`${activeModelId}|${activeTaskId}`) ?? { exec: 0, qa: 0 }
    : { exec: 0, qa: 0 };

  // Featured curated highlights
  const featuredItems = useMemo(() => {
    return CURATED_HIGHLIGHTS.filter(
      (h) => highlightFilter === 'all' || h.group === highlightFilter,
    )
      .map((h) => ({ highlight: h, ep: episodeById.get(h.episodeId) }))
      .filter(
        (x): x is { highlight: (typeof CURATED_HIGHLIGHTS)[number]; ep: EpisodeSummary } =>
          Boolean(x.ep),
      );
  }, [episodeById, highlightFilter]);

  const exportActiveCsv = () => {
    const episodesToExport = isFeaturedView
      ? index.episodes
      : seedRows.flatMap((r) => [r.exec, r.qa].filter((x): x is EpisodeSummary => Boolean(x)));
    const header = [
      'id',
      'model',
      'protocol',
      'category',
      'task',
      'seed',
      'score',
      'success',
      'rounds',
      'steps',
      'total_tokens',
      'termination_reason',
    ];
    const rows = episodesToExport.map((e) =>
      [
        e.id,
        e.model_label,
        e.protocol,
        e.category,
        e.task_id,
        e.seed,
        e.score.toFixed(2),
        e.success,
        e.rounds,
        e.steps,
        e.total_tokens,
        e.termination_reason,
      ]
        .map(csvCell)
        .join(','),
    );
    const blob = new Blob([[header.map(csvCell).join(','), ...rows].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isFeaturedView
      ? 'robometrix-all-3600-trajectories.csv'
      : `robometrix-${activeModelId}-${activeTaskId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1380px] space-y-6 px-5 py-8 sm:px-8 lg:px-10">
      {/* Top Bar: Clean Page Identity + Live 9-VLM Official-Logo Switcher */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {tr.explorerTitle}
            </h1>
            <span
              className="font-mono-metric text-xs"
              style={{ color: 'var(--ink-muted)' }}
            >
              9 VLMs · 20 Tasks · {index.total_episodes.toLocaleString()} Trajectories
            </span>
          </div>

          <button
            type="button"
            onClick={exportActiveCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: 'var(--line-subtle)',
              background: 'var(--bg-surface)',
              color: 'var(--ink-secondary)',
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isFeaturedView
                ? lang === 'en'
                  ? 'Export All CSV'
                  : '导出全部 CSV'
                : 'CSV'}
            </span>
          </button>
        </div>

        {/* Live 9-Model Official-Logo Rail (Shows per-task scores when a task is open!) */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label="Select model"
        >
          {orderedModels.map((m) => {
            const selected = !isFeaturedView && activeModelId === m.id;
            const scores = activeTaskId
              ? modelTaskScores.get(`${m.id}|${activeTaskId}`)
              : modelOverall.get(m.id);
            const displayScore =
              protocolView === 'qa' ? scores?.qa ?? 0 : scores?.exec ?? 0;
            const hasVideoHere = activeTaskId
              ? modelTaskPlayable.has(`${m.id}|${activeTaskId}`)
              : TASKS.some((item) => modelTaskPlayable.has(`${m.id}|${item.id}`));

            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={selected}
                onClick={() => selectModel(m.id)}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs transition-all"
                style={{
                  borderColor: selected ? 'var(--accent-primary)' : 'var(--line-subtle)',
                  background: selected ? 'var(--accent-soft)' : 'var(--bg-surface)',
                  color: selected ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                  boxShadow: selected ? '0 1px 3px rgba(26, 115, 232, 0.14)' : 'none',
                }}
              >
                <ProviderGlyph family={m.family} size={15} />
                <span className={selected ? 'font-semibold' : 'font-medium'}>{m.short}</span>
                <span
                  className="font-mono-metric text-[11px] font-semibold"
                  style={{
                    color: selected ? 'var(--accent-primary)' : 'var(--ink-muted)',
                  }}
                >
                  {displayScore.toFixed(1)}
                </span>
                {hasVideoHere ? (
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--accent-emerald)' }}
                    title={lang === 'en' ? 'Bundled video available' : '含可播视频'}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Master-Detail Workbench */}
      <div className="grid items-start gap-6 lg:grid-cols-[296px_minmax(0,1fr)]">
        {/* LEFT RAIL: Featured Shortcut + Searchable Categorized 20-Task Navigator */}
        <aside
          className="paper-plate overflow-hidden lg:sticky lg:top-20"
          aria-label="Task navigator"
        >
          {/* Pinned Featured Rollouts (16) Entry */}
          <div className="border-b p-3" style={{ borderColor: 'var(--line-subtle)' }}>
            <button
              type="button"
              aria-current={isFeaturedView ? 'true' : undefined}
              onClick={() => navigate('#/explorer')}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
              style={{
                background: isFeaturedView ? 'var(--accent-soft)' : 'transparent',
                color: isFeaturedView ? 'var(--accent-primary)' : 'var(--ink-primary)',
              }}
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{lang === 'en' ? 'Featured Videos' : '论文精选视频'}</span>
              </span>
              <span
                className="font-mono-metric rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                style={{
                  background: isFeaturedView
                    ? 'var(--bg-surface)'
                    : 'color-mix(in srgb, var(--accent-emerald) 13%, transparent)',
                  color: isFeaturedView ? 'var(--accent-primary)' : 'var(--accent-emerald)',
                }}
              >
                16
              </span>
            </button>
          </div>

          {/* Search + Category Quick Filter */}
          <div
            className="space-y-2.5 border-b p-3"
            style={{ borderColor: 'var(--line-subtle)' }}
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-45"
                aria-hidden="true"
              />
              <input
                type="search"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder={lang === 'en' ? 'Search 20 tasks...' : '搜索 20 项任务...'}
                aria-label="Search tasks"
                className="h-8 w-full rounded-lg border pl-8 pr-2.5 text-xs"
                style={{
                  borderColor: 'var(--line-subtle)',
                  background: 'var(--bg-page)',
                  color: 'var(--ink-primary)',
                }}
              />
            </div>

            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter tasks by category">
              {(['ALL', ...CATEGORIES.map((c) => c.id)] as const).map((cid) => {
                const active = catFilter === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCatFilter(cid)}
                    className="font-mono-metric rounded-md px-2 py-0.5 text-[10.5px] font-semibold transition-colors"
                    style={{
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      color: active ? 'var(--accent-primary)' : 'var(--ink-muted)',
                    }}
                  >
                    {cid === 'ALL' ? (lang === 'en' ? 'All' : '全部') : cid}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categorized 20-Task List with Dual Exec/QA Micro-Readouts */}
          <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto p-2">
            {visibleCategories.map(({ cat, items }) => (
              <div key={cat.id} className="mb-2.5 last:mb-0">
                <div className="flex items-center justify-between px-2.5 py-1">
                  <span
                    className="font-mono-metric text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    {cat.id} · {lang === 'en' ? cat.shortEn : cat.nameZh}
                  </span>
                  <span
                    className="font-mono-metric text-[10px]"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    Exec / QA
                  </span>
                </div>

                <div className="space-y-0.5">
                  {items.map((item) => {
                    const selected = !isFeaturedView && activeTaskId === item.id;
                    const scores = modelTaskScores.get(`${activeModelId}|${item.id}`) ?? {
                      exec: 0,
                      qa: 0,
                    };
                    const hasVideo = isFeaturedView
                      ? taskHasAnyPlayable.has(item.id)
                      : modelTaskPlayable.has(`${activeModelId}|${item.id}`);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => selectTask(item.id)}
                        className="group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors"
                        style={{
                          background: selected ? 'var(--accent-soft)' : 'transparent',
                          color: selected ? 'var(--accent-primary)' : 'var(--ink-primary)',
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-medium">
                            {lang === 'en' ? item.nameEn : item.nameZh}
                          </span>
                          {hasVideo ? (
                            <span
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: 'var(--accent-emerald)' }}
                              title={lang === 'en' ? 'Playable video bundled' : '含可播视频'}
                            />
                          ) : null}
                        </span>

                        <span className="font-mono-metric shrink-0 text-[11px]">
                          <span
                            className="font-semibold"
                            style={{
                              color: selected ? 'var(--accent-primary)' : 'var(--ink-primary)',
                            }}
                          >
                            {scores.exec.toFixed(0)}
                          </span>
                          <span style={{ color: 'var(--ink-muted)' }}>/</span>
                          <span style={{ color: 'var(--ink-muted)' }}>
                            {scores.qa.toFixed(0)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {visibleCategories.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs" style={{ color: 'var(--ink-muted)' }}>
                {lang === 'en' ? 'No matching tasks' : '无匹配任务'}
              </p>
            ) : null}
          </div>
        </aside>

        {/* RIGHT STAGE: Spacious 2-Column Rollout Canvas */}
        <section className="min-w-0 space-y-5">
          {isFeaturedView ? (
            /* ========== FEATURED ROLLOUTS (16 PLAYABLE VIDEOS) ========== */
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-2.5">
                  <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                    {lang === 'en' ? 'Featured Playable Rollouts' : '论文精选可播轨迹'}
                  </h2>
                  <span className="font-mono-metric text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {featuredItems.length} videos
                  </span>
                </div>

                {/* Clean 4-Way Chapter Filter Pill */}
                <div
                  className="inline-flex flex-wrap rounded-full border p-0.5 text-xs"
                  style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-subtle)' }}
                  role="group"
                  aria-label="Filter featured rollouts"
                >
                  {(
                    [
                      { id: 'all', en: 'All 16', zh: '全部 16' },
                      { id: 'precision', en: 'Precision Exec', zh: '高精度执行' },
                      { id: 'measurement', en: 'Active QA', zh: '主动测量' },
                      { id: 'failures', en: 'Gaps & Failures', zh: '鸿沟与失败' },
                    ] as const
                  ).map((opt) => {
                    const active = highlightFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setHighlightFilter(opt.id)}
                        className="rounded-full px-3 py-1 font-medium transition-colors"
                        style={{
                          background: active ? 'var(--bg-surface)' : 'transparent',
                          color: active ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                          boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        }}
                      >
                        {lang === 'en' ? opt.en : opt.zh}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {featuredItems.map(({ highlight, ep }) => {
                  const taskMeta = TASK_BY_ID[ep.task_id];
                  const pairedProto: Protocol = ep.protocol === 'qa' ? 'execution' : 'qa';
                  const pairedEp = episodeById.get(
                    makeEpisodeId(ep.model_id, pairedProto, ep.task_id, ep.seed),
                  );

                  return (
                    <a
                      key={ep.id}
                      href={buildTrajectoryHref(ep.model_id, ep.protocol, ep.task_id, ep.seed)}
                      className="paper-plate group flex flex-col overflow-hidden no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      style={{ color: 'var(--ink-primary)' }}
                    >
                      <div className="relative aspect-[40/21] w-full overflow-hidden bg-slate-950">
                        <img
                          src={episodePosterUrl(ep)}
                          onError={(event) => setTaskPosterFallback(event.currentTarget, ep.task_id)}
                          alt={`${ep.model_label} ${ep.task_id} seed ${ep.seed}`}
                          width={1280}
                          height={672}
                          loading="lazy"
                          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-950/60 to-transparent" />

                        <span
                          className="font-mono-metric absolute left-3 top-3 rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase text-white backdrop-blur-sm"
                          style={{
                            background:
                              ep.protocol === 'qa'
                                ? 'rgba(29, 78, 216, 0.9)'
                                : 'rgba(180, 83, 9, 0.9)',
                          }}
                        >
                          {ep.protocol === 'qa' ? 'Metric QA' : 'Execution'} · s{ep.seed}
                        </span>

                        <span className="font-mono-metric absolute bottom-2.5 right-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/75 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors group-hover:bg-blue-600">
                          <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                          <span>
                            {ep.rounds} {ep.rounds === 1 ? 'round' : 'rounds'}
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col gap-2.5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-[15px] font-semibold">
                              {lang === 'en' ? taskMeta?.nameEn : taskMeta?.nameZh}
                            </h3>
                            <div
                              className="mt-0.5 flex items-center gap-2 text-xs"
                              style={{ color: 'var(--ink-secondary)' }}
                            >
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <ProviderGlyph family={ep.family} size={14} />
                                <span>{ep.model_label}</span>
                              </span>
                              {pairedEp ? (
                                <>
                                  <span className="opacity-30">·</span>
                                  <span
                                    className="font-mono-metric text-[11px]"
                                    style={{ color: 'var(--ink-muted)' }}
                                  >
                                    {pairedProto === 'qa' ? 'QA' : 'Exec'} {pairedEp.score.toFixed(1)}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          <span
                            className="font-mono-metric shrink-0 rounded-md px-2.5 py-0.5 text-xs font-bold"
                            style={scoreBadgeStyle(ep.score)}
                          >
                            {ep.score.toFixed(1)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span
                            className="font-mono-metric rounded-md px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: 'var(--bg-subtle)', color: 'var(--ink-primary)' }}
                          >
                            {lang === 'en' ? highlight.badgeEn : highlight.badgeZh}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold transition-transform group-hover:translate-x-0.5"
                            style={{ color: 'var(--accent-primary)' }}
                          >
                            <span>{lang === 'en' ? 'Watch' : '观看'}</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        </div>

                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: 'var(--ink-secondary)' }}
                        >
                          {lang === 'en' ? highlight.noteEn : highlight.noteZh}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </>
          ) : activeTaskMeta ? (
            /* ========== TASK WORKSPACE (10 MATCHED SEEDS FOR ACTIVE MODEL + TASK) ========== */
            <>
              {/* Clean Task Workspace Header */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-2xl font-semibold tracking-tight">
                      {lang === 'en' ? activeTaskMeta.nameEn : activeTaskMeta.nameZh}
                    </h2>
                    <span
                      className="font-mono-metric rounded-md px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--ink-muted)' }}
                    >
                      {activeTaskMeta.category}
                    </span>
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-2 text-xs"
                    style={{ color: 'var(--ink-secondary)' }}
                  >
                    <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      <ProviderGlyph family={activeModel.family} size={15} />
                      <span>{activeModel.label}</span>
                    </span>
                    <span className="opacity-35">·</span>
                    <span>
                      {protocolView === 'qa'
                        ? lang === 'en'
                          ? activeTaskMeta.qaEn
                          : activeTaskMeta.qaZh
                        : lang === 'en'
                          ? activeTaskMeta.execEn
                          : activeTaskMeta.execZh}
                    </span>
                  </div>
                </div>

                {/* Right: Protocol Toggle + Clean Task Mean Readout */}
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="inline-flex rounded-full border p-0.5 text-xs"
                    style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-subtle)' }}
                    role="group"
                    aria-label="Protocol view"
                  >
                    {(
                      [
                        { id: 'paired', label: lang === 'en' ? 'Paired' : '双协议' },
                        { id: 'execution', label: 'Exec' },
                        { id: 'qa', label: 'QA' },
                      ] as const
                    ).map((opt) => {
                      const active = protocolView === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => selectProtocol(opt.id)}
                          className="rounded-full px-3 py-1 font-semibold transition-colors"
                          style={{
                            background: active ? 'var(--bg-surface)' : 'transparent',
                            color: active ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-right">
                    <div
                      className="font-mono-metric text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      10-SEED MEAN
                    </div>
                    <div className="font-mono-metric text-sm font-bold">
                      <span style={{ color: 'var(--accent-primary)' }}>
                        {activeTaskStats.exec.toFixed(1)}
                      </span>
                      <span className="mx-1 font-normal" style={{ color: 'var(--ink-muted)' }}>
                        /
                      </span>
                      <span style={{ color: 'var(--accent-amber)' }}>
                        {activeTaskStats.qa.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spacious 2-Column 10-Seed Grid */}
              <div className="grid gap-5 md:grid-cols-2">
                {seedRows.map(({ seed, exec, qa, hasVideo }) => {
                  if (protocolView === 'paired') {
                    const posterEp =
                      (exec && isEpisodePlayable(exec) ? exec : null) ??
                      (qa && isEpisodePlayable(qa) ? qa : null) ??
                      exec ??
                      qa;
                    if (!posterEp) return null;

                    const execErr = exec ? formatPrimaryError(exec) : null;
                    const qaErr = qa ? formatPrimaryError(qa) : null;

                    return (
                      <article
                        key={seed}
                        className="paper-plate flex flex-col overflow-hidden transition-shadow hover:shadow-md"
                      >
                        {/* Clickable Large 16:9 Scene Preview */}
                        <a
                          href={buildTrajectoryHref(
                            posterEp.model_id,
                            posterEp.protocol,
                            posterEp.task_id,
                            seed,
                          )}
                          className="group relative block aspect-[40/21] w-full overflow-hidden bg-slate-950"
                        >
                          <img
                            src={episodePosterUrl(posterEp)}
                            onError={(event) =>
                              setTaskPosterFallback(event.currentTarget, posterEp.task_id)
                            }
                            alt={`${activeModel.label} ${activeTaskMeta.nameEn} seed ${seed}`}
                            width={1280}
                            height={672}
                            loading="lazy"
                            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                          <span className="font-mono-metric absolute left-3 top-3 rounded-md bg-slate-950/75 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                            Seed {seed}
                          </span>
                          {hasVideo ? (
                            <span className="font-mono-metric absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-950/75 px-2.5 py-0.5 text-[10.5px] font-medium text-emerald-300 backdrop-blur-sm">
                              <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                              <span>Video</span>
                            </span>
                          ) : null}
                        </a>

                        {/* Paired Dual-Protocol Action Split (Signature RoboMetriX Feature) */}
                        <div
                          className="grid grid-cols-2 divide-x border-t"
                          style={{ borderColor: 'var(--line-subtle)' }}
                        >
                          {[
                            {
                              label: 'Execution',
                              ep: exec,
                              err: execErr,
                              proto: 'execution' as const,
                              accent: 'var(--accent-primary)',
                            },
                            {
                              label: 'Metric QA',
                              ep: qa,
                              err: qaErr,
                              proto: 'qa' as const,
                              accent: 'var(--accent-amber)',
                            },
                          ].map((cell) => {
                            if (!cell.ep) {
                              return (
                                <div key={cell.proto} className="p-3.5 text-xs opacity-40">
                                  {cell.label} —
                                </div>
                              );
                            }
                            const cellPlayable = isEpisodePlayable(cell.ep);
                            return (
                              <a
                                key={cell.proto}
                                href={buildTrajectoryHref(
                                  cell.ep.model_id,
                                  cell.proto,
                                  cell.ep.task_id,
                                  seed,
                                )}
                                className="group/cell flex flex-col gap-1 p-3.5 no-underline transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.03]"
                                style={{
                                  borderColor: 'var(--line-subtle)',
                                  color: 'var(--ink-primary)',
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: cell.accent }}>
                                    <span>{cell.label}</span>
                                    {cellPlayable ? (
                                      <Play
                                        className="h-2.5 w-2.5 fill-current"
                                        style={{ color: 'var(--accent-emerald)' }}
                                        aria-hidden="true"
                                      />
                                    ) : null}
                                  </span>
                                  <span
                                    className="font-mono-metric text-sm font-bold"
                                    style={{ color: scoreColor(cell.ep.score) }}
                                  >
                                    {cell.ep.score.toFixed(1)}
                                  </span>
                                </div>
                                <div
                                  className="font-mono-metric flex items-center justify-between gap-2 text-[11px]"
                                  style={{ color: 'var(--ink-muted)' }}
                                >
                                  <span className="truncate">
                                    {cell.err ?? `${cell.ep.rounds}r · ${cell.ep.steps} steps`}
                                  </span>
                                  <ArrowRight
                                    className="h-3 w-3 shrink-0 opacity-45 transition-transform group-hover/cell:translate-x-0.5 group-hover/cell:opacity-100"
                                    aria-hidden="true"
                                  />
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </article>
                    );
                  }

                  // Single-protocol mode (Execution or Metric QA)
                  const ep = protocolView === 'qa' ? qa : exec;
                  if (!ep) return null;
                  const playable = isEpisodePlayable(ep);
                  const errText = formatPrimaryError(ep);

                  return (
                    <a
                      key={seed}
                      href={buildTrajectoryHref(ep.model_id, ep.protocol, ep.task_id, seed)}
                      className="paper-plate group flex flex-col overflow-hidden no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      style={{ color: 'var(--ink-primary)' }}
                    >
                      <div className="relative aspect-[40/21] w-full overflow-hidden bg-slate-950">
                        <img
                          src={episodePosterUrl(ep)}
                          onError={(event) => setTaskPosterFallback(event.currentTarget, ep.task_id)}
                          alt={`${ep.model_label} ${activeTaskMeta.nameEn} seed ${seed}`}
                          width={1280}
                          height={672}
                          loading="lazy"
                          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        <span className="font-mono-metric absolute left-3 top-3 rounded-md bg-slate-950/75 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                          Seed {seed}
                        </span>
                        {playable ? (
                          <span className="font-mono-metric absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-950/75 px-2.5 py-0.5 text-[10.5px] font-medium text-emerald-300 backdrop-blur-sm">
                            <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                            <span>Video</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">Seed {seed}</span>
                            {errText ? (
                              <span
                                className="font-mono-metric rounded px-1.5 py-0.5 text-[10.5px]"
                                style={{ background: 'var(--bg-subtle)', color: 'var(--ink-secondary)' }}
                              >
                                {errText}
                              </span>
                            ) : null}
                          </div>
                          <div
                            className="font-mono-metric mt-0.5 text-[11px]"
                            style={{ color: 'var(--ink-muted)' }}
                          >
                            {ep.rounds} {ep.rounds === 1 ? 'round' : 'rounds'} · {ep.steps} steps ·{' '}
                            {Math.round(ep.total_tokens / 1000)}k tok
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5">
                          <span
                            className="font-mono-metric rounded-md px-2.5 py-0.5 text-xs font-bold"
                            style={scoreBadgeStyle(ep.score)}
                          >
                            {ep.score.toFixed(1)}
                          </span>
                          <ArrowRight
                            className="h-4 w-4 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
                            style={{ color: 'var(--accent-primary)' }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
