import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Play,
  XCircle,
} from 'lucide-react';
import type {
  EpisodeSummary,
  IndexPayload,
  Lang,
  Protocol,
  TimelineDocument,
  TimelineRound,
} from '../types/benchmark';
import { TASK_BY_ID } from '../data/benchmarkMeta';
import { t } from '../lib/i18n';
import {
  episodeAssetUrl,
  episodeBasePath,
  fetchTimeline,
  isEpisodePlayable,
  makeEpisodeId,
  setTaskPosterFallback,
  taskPosterUrl,
} from '../lib/dataClient';
import { buildExplorerHref, buildTrajectoryHref, navigate } from '../lib/router';
import { handleTabKeyDown } from '../lib/tabs';
import { CinemaPlayer } from '../components/CinemaPlayer';
import {
  ErrorRulerBar,
  humanizeConstraint,
  ScoreBar,
  scoreBadgeStyle,
} from '../components/MetricGauge';
import { familyFromModelId, ProviderGlyph } from '../components/ProviderBadge';
import { RoundInspector } from '../components/RoundInspector';

interface TrajectoryStudioPageProps {
  index: IndexPayload;
  lang: Lang;
  modelId: string;
  protocol: Protocol;
  taskId: string;
  seed: number;
  initialRound?: number;
}

function unitFromField(field: string): { unit: string; cutoff: number } {
  const suffix = field.split('_').pop() ?? 'cm';
  const cutoffs: Record<string, { unit: string; cutoff: number }> = {
    cm: { unit: 'cm', cutoff: 1.0 },
    deg: { unit: '°', cutoff: 1.0 },
    cm2: { unit: 'cm²', cutoff: 2.0 },
    cm3: { unit: 'cm³', cutoff: 5.0 },
  };
  return cutoffs[suffix] ?? { unit: suffix, cutoff: 1.0 };
}

export function TrajectoryStudioPage({
  index,
  lang,
  modelId,
  protocol,
  taskId,
  seed,
  initialRound,
}: TrajectoryStudioPageProps) {
  const tr = t(lang);
  const epId = makeEpisodeId(modelId, protocol, taskId, seed);

  const summary = useMemo(
    () => index.episodes.find((e) => e.id === epId) ?? null,
    [epId, index.episodes],
  );

  // Paired protocol episode (QA <-> Execution) on exact same model + task + seed
  const pairedProtocol: Protocol = protocol === 'qa' ? 'execution' : 'qa';
  const pairedSummary = useMemo(
    () =>
      index.episodes.find(
        (e) => e.id === makeEpisodeId(modelId, pairedProtocol, taskId, seed),
      ) ?? null,
    [index.episodes, modelId, pairedProtocol, seed, taskId],
  );

  // All 9 models on this exact (protocol, task, seed) for 1-click cross-model switching
  const peerModels = useMemo(() => {
    return index.episodes
      .filter((e) => e.protocol === protocol && e.task_id === taskId && e.seed === seed)
      .sort(
        (a, b) =>
          Number(isEpisodePlayable(b)) - Number(isEpisodePlayable(a)) || b.score - a.score,
      );
  }, [index.episodes, protocol, seed, taskId]);

  // All 10 seeds for this exact (model, protocol, task)
  const peerSeeds = useMemo(() => {
    return index.episodes
      .filter((e) => e.model_id === modelId && e.protocol === protocol && e.task_id === taskId)
      .sort((a, b) => a.seed - b.seed);
  }, [index.episodes, modelId, protocol, taskId]);

  // Any playable video episode on this same task (helpful fallback when viewing an archive-only episode)
  const playableTaskFallback = useMemo<EpisodeSummary | null>(() => {
    return (
      index.episodes.find(
        (e) => e.task_id === taskId && isEpisodePlayable(e) && e.id !== epId,
      ) ?? null
    );
  }, [epId, index.episodes, taskId]);

  const [loadedTimeline, setLoadedTimeline] = useState<TimelineDocument | null>();
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [activeRound, setActiveRound] = useState(initialRound ?? 1);
  const [seekRequest, setSeekRequest] = useState<{ round: TimelineRound } | null>(null);
  const [rightTab, setRightTab] = useState<'inspector' | 'metrics' | 'prompts'>('inspector');
  const [instructionExpanded, setInstructionExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const tabs = [
    { id: 'inspector' as const, label: lang === 'en' ? 'Step Trace' : '逐轮追踪' },
    { id: 'metrics' as const, label: lang === 'en' ? 'Metrics' : '评测指标' },
    { id: 'prompts' as const, label: lang === 'en' ? 'Prompt & Tools' : '提示与工具' },
  ];

  const basePath = summary
    ? episodeBasePath(
        summary.model_id,
        summary.protocol,
        summary.task_id,
        summary.seed,
        summary.bundled,
      )
    : null;
  const timeline = loadedTimeline?.id === epId ? loadedTimeline : null;
  const loading = Boolean(basePath) && loadedForId !== epId;

  useEffect(() => {
    setActiveRound(initialRound ?? 1);
    setSeekRequest(null);
    setInstructionExpanded(false);
    if (!summary || !basePath) {
      setLoadedForId(epId);
      setLoadedTimeline(null);
      return;
    }
    let alive = true;
    fetchTimeline(
      summary.model_id,
      summary.protocol,
      summary.task_id,
      summary.seed,
      summary.bundled,
    ).then((doc) => {
      if (alive) {
        setLoadedTimeline(doc);
        setLoadedForId(epId);
      }
    });
    return () => {
      alive = false;
    };
  }, [basePath, epId, summary]);

  const totalRounds = timeline?.rounds.length ?? 0;
  const clampedActiveRound = totalRounds > 0 ? Math.max(1, Math.min(activeRound, totalRounds)) : 1;
  const currentRoundObj = timeline?.rounds[clampedActiveRound - 1] ?? null;

  const selectRoundAndSeek = (roundNum: number) => {
    const round = timeline?.rounds[Math.max(0, Math.min(totalRounds - 1, roundNum - 1))];
    if (round) {
      setActiveRound(round.round);
      setSeekRequest({ round });
    }
  };

  useEffect(() => {
    if (!timeline || timeline.rounds.length === 0) return;
    const targetNum =
      initialRound !== undefined
        ? Math.max(1, Math.min(initialRound, timeline.rounds.length))
        : 1;
    const round = timeline.rounds[targetNum - 1];
    if (round) {
      setActiveRound(round.round);
      setSeekRequest({ round });
    }
  }, [initialRound, timeline]);

  if (!summary) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Trajectory not found</h1>
        <p className="mt-2 font-mono-metric text-xs" style={{ color: 'var(--ink-muted)' }}>
          {epId}
        </p>
        <a
          href="#/explorer"
          className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white no-underline"
          style={{ background: '#1a73e8' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{tr.backExplorer}</span>
        </a>
      </div>
    );
  }

  const taskMeta = TASK_BY_ID[summary.task_id];
  const videoUrl = isEpisodePlayable(summary) ? episodeAssetUrl(basePath, timeline?.video) : null;
  const taskPoster = taskPosterUrl(summary.task_id);
  const posterUrl = episodeAssetUrl(basePath, timeline?.poster) ?? taskPoster;

  const qaPeer = protocol === 'qa' ? summary : pairedSummary;
  const execPeer = protocol === 'execution' ? summary : pairedSummary;

  const copyDeepLink = () => {
    const href = buildTrajectoryHref(
      summary.model_id,
      summary.protocol,
      summary.task_id,
      summary.seed,
      clampedActiveRound,
    );
    const full = `${window.location.origin}${window.location.pathname}${href}`;
    navigator.clipboard?.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="mx-auto max-w-[1380px] space-y-5 px-5 py-6 sm:px-8 lg:px-10">
      {/* Unified Header + Instant In-Place Context Switcher (QA ↔ Exec · Model · Seed) */}
      <header className="paper-plate space-y-3.5 px-5 py-4">
        {/* Top Row: Back + Task Identity + Verdict + Share */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={buildExplorerHref({
                model: summary.model_id,
                task: summary.task_id,
              })}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium no-underline transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--line-subtle)', color: 'var(--ink-secondary)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tr.navExplorer}</span>
            </a>

            <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              {lang === 'en' ? taskMeta?.nameEn : taskMeta?.nameZh}
            </h1>

            <span
              className="font-mono-metric rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: 'var(--bg-subtle)', color: 'var(--ink-muted)' }}
            >
              {summary.category}
            </span>

            <span
              className="font-mono-metric inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={scoreBadgeStyle(summary.score)}
            >
              {summary.scored_success ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{summary.score.toFixed(1)}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={copyDeepLink}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: 'var(--line-subtle)',
              background: 'var(--bg-page)',
              color: copied ? 'var(--accent-emerald)' : 'var(--ink-secondary)',
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? (lang === 'en' ? 'Link Copied' : '已复制链接') : lang === 'en' ? 'Share' : '分享'}</span>
          </button>
        </div>

        {/* Bottom Row: Instant Protocol (QA ↔ Exec), Model, and Seed Switchers */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
          style={{ borderColor: 'var(--line-subtle)' }}
        >
          {/* Matched Protocol Switcher (Shows Live Scores for Both Paired Protocols!) */}
          <div
            className="inline-flex flex-wrap items-center gap-1 rounded-full border p-0.5"
            style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-subtle)' }}
            role="group"
            aria-label="Switch matched protocol"
          >
            {(
              [
                { id: 'execution' as const, label: 'Execution', peer: execPeer },
                { id: 'qa' as const, label: 'Metric QA', peer: qaPeer },
              ] as const
            ).map((opt) => {
              const active = protocol === opt.id;
              const playable = opt.peer ? isEpisodePlayable(opt.peer) : false;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  disabled={!opt.peer}
                  onClick={() => {
                    if (!active && opt.peer) {
                      navigate(buildTrajectoryHref(modelId, opt.id, taskId, seed));
                    }
                  }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: active ? 'var(--bg-surface)' : 'transparent',
                    color: active ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                    boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.peer ? (
                    <span
                      className="font-mono-metric text-[11px]"
                      style={{
                        color: active
                          ? opt.id === 'qa'
                            ? 'var(--accent-primary)'
                            : 'var(--accent-amber)'
                          : 'var(--ink-muted)',
                      }}
                    >
                      {opt.peer.score.toFixed(1)}
                    </span>
                  ) : null}
                  {playable ? (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--accent-emerald)' }}
                      title="Bundled video available"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Model + Seed Instant Switchers */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Cross-Model Selector with Official Provider Logo */}
            <div
              className="inline-flex h-8 items-center gap-2 rounded-full border pl-2.5 pr-1.5"
              style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-page)' }}
            >
              <ProviderGlyph
                family={summary.family || familyFromModelId(summary.model_id)}
                size={15}
              />
              <select
                aria-label="Switch model on same task and seed"
                value={summary.model_id}
                onChange={(e) =>
                  navigate(buildTrajectoryHref(e.target.value, protocol, taskId, seed))
                }
                className="h-full bg-transparent pr-1 text-xs font-semibold focus:outline-none"
                style={{ color: 'var(--ink-primary)' }}
              >
                {peerModels.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {isEpisodePlayable(m) ? '▶ ' : ''}
                    {m.model_label} ({m.score.toFixed(1)})
                  </option>
                ))}
              </select>
            </div>

            {/* Seed Stepper + Dropdown */}
            <div
              className="inline-flex h-8 items-center rounded-full border"
              style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-page)' }}
            >
              <button
                type="button"
                disabled={summary.seed <= 100}
                onClick={() =>
                  navigate(buildTrajectoryHref(modelId, protocol, taskId, summary.seed - 1))
                }
                className="inline-flex h-full w-7 items-center justify-center rounded-l-full transition-colors hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/5"
                aria-label="Previous seed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <select
                aria-label="Select seed"
                value={String(summary.seed)}
                onChange={(e) =>
                  navigate(buildTrajectoryHref(modelId, protocol, taskId, Number(e.target.value)))
                }
                className="font-mono-metric h-full bg-transparent px-1 text-xs font-medium focus:outline-none"
                style={{ color: 'var(--ink-primary)' }}
              >
                {peerSeeds.map((ep) => (
                  <option key={ep.seed} value={String(ep.seed)}>
                    {isEpisodePlayable(ep) ? '▶ ' : ''}s{ep.seed} ({ep.score.toFixed(1)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={summary.seed >= 109}
                onClick={() =>
                  navigate(buildTrajectoryHref(modelId, protocol, taskId, summary.seed + 1))
                }
                className="inline-flex h-full w-7 items-center justify-center rounded-r-full transition-colors hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/5"
                aria-label="Next seed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Split Workspace (7:5 on desktop) */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Sticky Cinema Stage + Clean Quantitative Metrology */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:col-span-7">
          {basePath && timeline ? (
            <CinemaPlayer
              key={epId}
              videoUrl={videoUrl}
              posterUrl={posterUrl}
              fallbackPosterUrl={taskPoster}
              controlDtS={timeline.control_dt_s}
              rounds={timeline.rounds}
              activeRound={clampedActiveRound}
              onSelectRound={setActiveRound}
              seekRequest={seekRequest}
              keyboardShortcuts
              title={`${summary.model_label} · ${taskMeta?.nameEn ?? summary.task_id} · seed-${summary.seed}`}
            />
          ) : loading ? (
            <div className="cinema-stage flex aspect-[1280/672] items-center justify-center rounded-2xl text-sm text-slate-400">
              Loading trajectory...
            </div>
          ) : (
            <div className="cinema-stage overflow-hidden rounded-2xl">
              <div className="relative aspect-[1280/672] w-full bg-[#06090f]">
                <img
                  src={posterUrl}
                  onError={(event) => setTaskPosterFallback(event.currentTarget, summary.task_id)}
                  alt={summary.task_id}
                  width={640}
                  height={480}
                  className="h-full w-full object-cover opacity-35"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/65 p-6 text-center">
                  <Database className="h-6 w-6 text-sky-400" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-white">{tr.videoUnavailableTitle}</h2>
                  <p className="max-w-md text-xs leading-relaxed text-slate-300">
                    {tr.videoUnavailableDesc}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    {playableTaskFallback ? (
                      <a
                        href={buildTrajectoryHref(
                          playableTaskFallback.model_id,
                          playableTaskFallback.protocol,
                          playableTaskFallback.task_id,
                          playableTaskFallback.seed,
                        )}
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white no-underline hover:bg-blue-500"
                      >
                        <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                        <span>
                          {lang === 'en'
                            ? `Watch Playable ${playableTaskFallback.model_short} (${playableTaskFallback.protocol === 'qa' ? 'QA' : 'Exec'} s${playableTaskFallback.seed})`
                            : `观看同任务可播回放（${playableTaskFallback.model_short} · s${playableTaskFallback.seed}）`}
                        </span>
                      </a>
                    ) : null}
                    <a
                      href="#/explorer"
                      className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white no-underline hover:bg-white/20"
                    >
                      {lang === 'en' ? '16 Featured Rollouts →' : '查看 16 条精选视频 →'}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clean Outcome & Physical Metrology Card */}
          <section className="paper-plate space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono-metric text-2xl font-bold tracking-tight">
                  {summary.score.toFixed(1)}
                  <span className="text-xs font-normal" style={{ color: 'var(--ink-muted)' }}>
                    {' '}
                    / 100
                  </span>
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{
                    color: summary.scored_success ? 'var(--accent-emerald)' : 'var(--accent-danger)',
                  }}
                >
                  {summary.scored_success
                    ? lang === 'en'
                      ? 'Passed'
                      : '达标'
                    : lang === 'en'
                      ? 'Not Passed'
                      : '未达标'}
                </span>
              </div>

              <div className="font-mono-metric flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
                <span>
                  {summary.rounds} {summary.rounds === 1 ? 'round' : 'rounds'}
                </span>
                <span>
                  {summary.steps} {summary.steps === 1 ? 'step' : 'steps'}
                </span>
                <span>{Math.round(summary.total_tokens / 1000).toLocaleString()}k tok</span>
                <span>{summary.wall_time_s.toFixed(0)}s</span>
              </div>
            </div>

            <ScoreBar score={summary.score} />

            {/* Humanized Error Ruler Bars */}
            {Object.keys(summary.errors).length > 0 ? (
              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                {Object.entries(summary.errors).map(([field, errVal]) => {
                  const { unit, cutoff } = unitFromField(field);
                  return (
                    <ErrorRulerBar
                      key={field}
                      label={field}
                      error={errVal}
                      cutoff={cutoff}
                      unit={unit}
                      componentScore={summary.component_scores[field]}
                    />
                  );
                })}
              </div>
            ) : null}

            {/* Humanized Hard Validity Constraints */}
            {Object.keys(summary.hard_constraints).length > 0 ? (
              <div
                className="flex flex-wrap items-center gap-2 border-t pt-3"
                style={{ borderColor: 'var(--line-subtle)' }}
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {lang === 'en' ? 'Validity' : '硬约束'}
                </span>
                {Object.entries(summary.hard_constraints).flatMap(([obj, conds]) =>
                  Object.entries(conds).map(([cname, passed]) => (
                    <span
                      key={`${obj}-${cname}`}
                      title={`${obj}.${cname}`}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        background: passed
                          ? 'color-mix(in srgb, var(--accent-emerald) 11%, transparent)'
                          : 'color-mix(in srgb, var(--accent-danger) 11%, transparent)',
                        color: passed ? 'var(--accent-emerald)' : 'var(--accent-danger)',
                      }}
                    >
                      <span>{passed ? '✓' : '✕'}</span>
                      <span>{humanizeConstraint(obj, cname)}</span>
                    </span>
                  )),
                )}
              </div>
            ) : null}

            {summary.failure_reason ? (
              <p
                className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
                style={{
                  borderColor: 'color-mix(in srgb, var(--accent-danger) 28%, transparent)',
                  background: 'color-mix(in srgb, var(--accent-danger) 6%, transparent)',
                  color: 'var(--ink-primary)',
                }}
              >
                {summary.failure_reason}
              </p>
            ) : null}
          </section>
        </div>

        {/* Right Column: Story-First Step Trace & Details */}
        <div className="paper-plate overflow-hidden lg:col-span-5">
          <div className="border-b px-4 py-2.5" style={{ borderColor: 'var(--line-subtle)' }}>
            <div
              className="metric-tablist"
              role="tablist"
              aria-label="Trajectory inspector panels"
              onKeyDown={handleTabKeyDown}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`studio-tab-${tab.id}`}
                  aria-selected={rightTab === tab.id}
                  tabIndex={rightTab === tab.id ? 0 : -1}
                  className="metric-tab"
                  onClick={() => setRightTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {tabs
            .filter((tab) => tab.id !== rightTab)
            .map(({ id }) => (
              <div
                key={id}
                id={`studio-panel-${id}`}
                role="tabpanel"
                aria-labelledby={`studio-tab-${id}`}
                hidden
              />
            ))}

          <div
            className="p-4 sm:p-5"
            id={`studio-panel-${rightTab}`}
            role="tabpanel"
            aria-labelledby={`studio-tab-${rightTab}`}
            tabIndex={0}
          >
            {rightTab === 'inspector' ? (
              <div className="space-y-4">
                {/* Compact Collapsible Task Goal (2-line preview by default) */}
                <div
                  className="rounded-lg border px-3.5 py-2.5 text-xs"
                  style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-page)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10.5px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {lang === 'en' ? 'Episode Goal' : '本回合目标'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInstructionExpanded((prev) => !prev)}
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium hover:underline"
                      style={{ color: 'var(--accent-primary)' }}
                    >
                      <span>
                        {instructionExpanded
                          ? lang === 'en'
                            ? 'Collapse'
                            : '收起'
                          : lang === 'en'
                            ? 'Full prompt'
                            : '展开完整指令'}
                      </span>
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${instructionExpanded ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  <p
                    className={`mt-1 leading-relaxed ${instructionExpanded ? '' : 'line-clamp-2'}`}
                    style={{ color: 'var(--ink-secondary)' }}
                  >
                    {summary.instruction}
                  </p>
                </div>

                {currentRoundObj ? (
                  <RoundInspector
                    round={currentRoundObj}
                    totalRounds={totalRounds}
                    basePath={basePath}
                    lang={lang}
                    onPrevRound={() => selectRoundAndSeek(clampedActiveRound - 1)}
                    onNextRound={() => selectRoundAndSeek(clampedActiveRound + 1)}
                  />
                ) : (
                  <p className="py-10 text-center text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                    {loading
                      ? 'Loading step timeline...'
                      : lang === 'en'
                        ? 'Round-by-round trace is available on all 16 bundled demos (and all 3,600 episodes when the remote media archive is mounted). Switch to Metrics to inspect all quantitative fields.'
                        : '16 条精选轨迹内置完整逐轮推理追踪；挂载远端媒体归档后支持全部 3,600 条。当前可切换至「评测指标」查看全部定量数据。'}
                  </p>
                )}
              </div>
            ) : null}

            {rightTab === 'metrics' ? (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-2.5 text-xs">
                  {[
                    { k: 'Termination', v: summary.termination_reason.replace(/_/g, ' ') },
                    { k: 'Planning Failures', v: String(summary.planning_failures) },
                    { k: 'Tool Errors', v: String(summary.tool_errors) },
                    { k: 'Reasoning Tokens', v: summary.reasoning_tokens.toLocaleString() },
                  ].map((item) => (
                    <div
                      key={item.k}
                      className="rounded-lg border p-3"
                      style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-page)' }}
                    >
                      <dt className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {item.k}
                      </dt>
                      <dd className="font-mono-metric mt-0.5 text-sm font-semibold">{item.v}</dd>
                    </div>
                  ))}
                </dl>

                {timeline?.metrics ? (
                  <div className="space-y-2">
                    <h3
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {lang === 'en' ? 'Raw Simulator Metrics' : '仿真器原始评测字段'}
                    </h3>
                    <div
                      className="max-h-[420px] divide-y overflow-y-auto rounded-lg border px-3"
                      style={{
                        borderColor: 'var(--line-subtle)',
                        background: 'var(--bg-page)',
                      }}
                    >
                      {Object.entries(timeline.metrics).map(([k, v]) => (
                        <div
                          key={k}
                          className="font-mono-metric flex items-center justify-between gap-2 py-2 text-xs"
                          style={{ borderColor: 'var(--line-subtle)' }}
                        >
                          <span className="truncate" style={{ color: 'var(--ink-muted)' }}>
                            {k}
                          </span>
                          <strong className="shrink-0 font-medium">{String(v)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {rightTab === 'prompts' ? (
              <div className="space-y-4 text-xs">
                {timeline ? (
                  <>
                    <div>
                      <h3
                        className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--ink-muted)' }}
                      >
                        System Prompt
                      </h3>
                      <pre
                        className="font-mono-metric max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border p-3 text-[11px] leading-relaxed"
                        style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-page)' }}
                      >
                        {timeline.system_prompt}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <h3
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--ink-muted)' }}
                      >
                        Tool Schemas ({timeline.tools.length})
                      </h3>
                      {timeline.tools.map((tool) => (
                        <div
                          key={tool.name}
                          className="rounded-lg border p-3"
                          style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-page)' }}
                        >
                          <code
                            className="font-mono-metric font-semibold"
                            style={{ color: 'var(--accent-primary)' }}
                          >
                            {tool.name}
                          </code>
                          <p
                            className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed"
                            style={{ color: 'var(--ink-secondary)' }}
                          >
                            {tool.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-10 text-center" style={{ color: 'var(--ink-muted)' }}>
                    {lang === 'en'
                      ? 'System prompt and tool schemas are included in bundled/hosted timeline files.'
                      : '系统提示与工具定义随完整轨迹文件加载。'}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
