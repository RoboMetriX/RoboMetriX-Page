import { Fragment, useLayoutEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eye,
  Move3d,
  Send,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import type { Lang, TimelineRound, ToolCallEntry } from '../types/benchmark';
import { episodeAssetUrl } from '../lib/dataClient';
import { ModalDialog } from './ModalDialog';

interface RoundInspectorProps {
  round: TimelineRound;
  totalRounds: number;
  basePath: string | null;
  lang: Lang;
  onPrevRound?: () => void;
  onNextRound?: () => void;
}

const CAMERA_LABELS: Record<string, { en: string; zh: string }> = {
  cam_head: { en: 'Overhead', zh: '全局视角' },
  cam_left_wrist: { en: 'Left Wrist', zh: '左腕相机' },
  cam_right_wrist: { en: 'Right Wrist', zh: '右腕相机' },
};

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

function formatDimValue(dim: string, val: number): string {
  if (dim === 'gripper') {
    if (val >= 0.99) return 'Open';
    if (val <= 0.01) return 'Closed';
    return `${Math.round(val * 100)}%`;
  }
  if (dim.endsWith('_deg')) {
    return `${val.toFixed(1)}°`;
  }
  return `${val.toFixed(4)} m`;
}

function formatDelta(dim: string, delta: number): string {
  const periodic = dim === 'yaw_deg' || dim === 'pitch_deg';
  if (Math.abs(delta) < (periodic ? 0.05 : 0.0005)) return '0';
  const sign = delta > 0 ? '+' : '';
  if (dim === 'gripper') return `${sign}${Math.round(delta * 100)}%`;
  if (dim.endsWith('_deg')) return `${sign}${delta.toFixed(1)}°`;
  return `${sign}${(delta * 100).toFixed(1)} cm`;
}

function poseDelta(dim: string, delta: number | undefined): number | undefined {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) return undefined;
  if (dim !== 'yaw_deg' && dim !== 'pitch_deg') return delta;
  const wrapped = delta % 360;
  if (wrapped <= -180) return wrapped + 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

interface ArmDimRow {
  dim: string;
  val: number;
  delta?: number;
}

function splitArmTargets(targets: Record<string, number>, deltas: Record<string, number> | null) {
  const left: ArmDimRow[] = [];
  const right: ArmDimRow[] = [];
  for (const [k, val] of Object.entries(targets)) {
    const [arm, ...parts] = k.split('_');
    if ((arm !== 'left' && arm !== 'right') || typeof val !== 'number' || !Number.isFinite(val)) {
      continue;
    }
    const dim = parts.join('_');
    (arm === 'left' ? left : right).push({ dim, val, delta: poseDelta(dim, deltas?.[k]) });
  }
  return { left, right };
}

function summarizeArmMotion(rows: ArmDimRow[]): Array<{ label: string; highlight: boolean }> {
  const chips: Array<{ label: string; highlight: boolean }> = [];
  for (const r of rows) {
    if (r.dim === 'gripper') {
      if (r.delta !== undefined && Math.abs(r.delta) >= 0.05) {
        chips.push({
          label: `Gripper → ${formatDimValue('gripper', r.val)}`,
          highlight: true,
        });
      }
      continue;
    }
    if (r.delta === undefined) continue;
    if (r.dim.endsWith('_deg')) {
      if (Math.abs(r.delta) >= 2.0) {
        const axis = r.dim.replace('_deg', '');
        chips.push({
          label: `${axis[0].toUpperCase()}${axis.slice(1)} ${formatDelta(r.dim, r.delta)}`,
          highlight: Math.abs(r.delta) >= 10,
        });
      }
    } else if (Math.abs(r.delta) >= 0.002) {
      chips.push({
        label: `Δ${r.dim} ${formatDelta(r.dim, r.delta)}`,
        highlight: Math.abs(r.delta) >= 0.01,
      });
    }
  }
  return chips;
}

function describeAction(tc: ToolCallEntry, lang: Lang): { title: string; tone: 'blue' | 'emerald' | 'rose' } {
  if (tc.name === 'answer') {
    return { title: lang === 'en' ? 'Submit Metric Estimates' : '提交度量估计答案', tone: 'emerald' };
  }
  if (tc.name === 'done') {
    return { title: lang === 'en' ? 'Declare Task Complete' : '声明任务完成', tone: 'emerald' };
  }
  if (tc.name === 'give_up') {
    return { title: lang === 'en' ? 'Abandon Episode' : '主动放弃回合', tone: 'rose' };
  }
  if (tc.name === 'move_eef' && tc.targets) {
    const arms = splitArmTargets(tc.targets, tc.delta_targets);
    const lMoved = summarizeArmMotion(arms.left).length > 0;
    const rMoved = summarizeArmMotion(arms.right).length > 0;
    if (lMoved && rMoved) {
      return { title: lang === 'en' ? 'Bimanual Move' : '双臂协同移动', tone: 'blue' };
    }
    if (lMoved) {
      return { title: lang === 'en' ? 'Move Left Arm' : '左臂移动', tone: 'blue' };
    }
    if (rMoved) {
      return { title: lang === 'en' ? 'Move Right Arm' : '右臂移动', tone: 'blue' };
    }
    return { title: lang === 'en' ? 'Adjust End-Effectors' : '调整末端位姿', tone: 'blue' };
  }
  return { title: tc.name, tone: 'blue' };
}

function humanizeAnswerKey(key: string): string {
  return key
    .replace(/^item_(\d+)$/, 'Item $1')
    .replace(/^lane_(\d+)$/, 'Lane $1')
    .replace(/^block_(\d+)$/, 'Block $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RoundInspector({
  round,
  totalRounds,
  basePath,
  lang,
  onPrevRound,
  onNextRound,
}: RoundInspectorProps) {
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [showAfter, setShowAfter] = useState(false);

  useLayoutEffect(() => {
    setShowAfter(false);
  }, [basePath, round]);

  const activeImages =
    showAfter && round.after_images.length > 0 ? round.after_images : round.images;

  // Elevate primary narrative: use reasoning/message first; if absent, elevate single tool note/reason
  const rawThought = round.reasoning || round.message;
  const singleTc = round.tool_calls.length === 1 ? round.tool_calls[0] : null;
  const elevatedFromNote = !rawThought && Boolean(singleTc?.note);
  const elevatedFromReason = !rawThought && !elevatedFromNote && Boolean(singleTc?.reason);
  const primaryNarrative = rawThought || singleTc?.note || singleTc?.reason || null;

  // Evaluate planning & simulator feedback status compactly
  const failedPlans = round.planning.filter((p) => p.status !== 'Success');
  const errorFeedback = round.tool_feedback.filter((fb) => fb.status.toLowerCase() !== 'accepted');
  const allPlannedOk = round.planning.length > 0 && failedPlans.length === 0;
  const hasDiagnostics = failedPlans.length > 0 || errorFeedback.length > 0;

  return (
    <div className="space-y-4">
      {/* Compact Round Header + Inline Stepper */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
        style={{ borderColor: 'var(--line-subtle)' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono-metric rounded-md px-2 py-0.5 text-xs font-bold"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent-primary)',
            }}
          >
            R{String(round.round).padStart(2, '0')} / {String(totalRounds).padStart(2, '0')}
          </span>
          <span className="font-mono-metric text-xs" style={{ color: 'var(--ink-muted)' }}>
            Step {round.start_step}–{round.end_step} · {round.time_s.toFixed(1)}s
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: round.has_error
                ? 'color-mix(in srgb, var(--accent-danger) 12%, transparent)'
                : 'color-mix(in srgb, var(--accent-emerald) 12%, transparent)',
              color: round.has_error ? 'var(--accent-danger)' : 'var(--accent-emerald)',
            }}
          >
            {round.has_error ? (
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{round.status}</span>
          </span>
        </div>

        {onPrevRound && onNextRound ? (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled={round.round <= 1}
              onClick={onPrevRound}
              aria-label={lang === 'en' ? 'Previous round' : '上一轮'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:bg-black/5 disabled:opacity-35 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--line-subtle)', color: 'var(--ink-primary)' }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={round.round >= totalRounds}
              onClick={onNextRound}
              aria-label={lang === 'en' ? 'Next round' : '下一轮'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:bg-black/5 disabled:opacity-35 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--line-subtle)', color: 'var(--ink-primary)' }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* 1. Primary Narrative: Model Reasoning or Action Intent */}
      {primaryNarrative ? (
        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: elevatedFromReason ? 'var(--accent-danger)' : 'var(--accent-primary)' }}
            >
              {elevatedFromReason ? (
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {elevatedFromReason
                  ? lang === 'en'
                    ? 'Abandonment Rationale'
                    : '放弃原因'
                  : elevatedFromNote
                    ? lang === 'en'
                      ? 'Decision Intent'
                      : '当前轮次意图'
                    : lang === 'en'
                      ? 'Model Reasoning'
                      : '模型推理链'}
              </span>
            </h3>
            {round.reasoning_kind && rawThought ? (
              <span className="font-mono-metric text-[10.5px]" style={{ color: 'var(--ink-muted)' }}>
                {round.reasoning_kind.replace(/_/g, ' ')}
              </span>
            ) : null}
          </div>

          <div
            className="max-h-[240px] overflow-y-auto rounded-lg border-l-2 py-2.5 pl-3.5 pr-3 text-[13px] leading-[1.68]"
            style={{
              borderLeftColor: elevatedFromReason ? 'var(--accent-danger)' : 'var(--accent-primary)',
              background: elevatedFromReason
                ? 'color-mix(in srgb, var(--accent-danger) 7%, transparent)'
                : 'var(--bg-subtle)',
              color: 'var(--ink-secondary)',
            }}
          >
            <p className="whitespace-pre-wrap">{renderInlineBold(primaryNarrative)}</p>
          </div>
        </section>
      ) : null}

      {/* 2. Action Card (Clean Motion Digest + Collapsible 14-DoF Table + Integrated Status) */}
      {round.tool_calls.map((tc, idx) => {
        const actionMeta = describeAction(tc, lang);
        const arms = tc.targets ? splitArmTargets(tc.targets, tc.delta_targets) : null;
        const leftChips = arms ? summarizeArmMotion(arms.left) : [];
        const rightChips = arms ? summarizeArmMotion(arms.right) : [];
        const showNote = Boolean(tc.note && !(elevatedFromNote && idx === 0));
        const showReason = Boolean(tc.reason && !(elevatedFromReason && idx === 0));

        const toneColor =
          actionMeta.tone === 'emerald'
            ? 'var(--accent-emerald)'
            : actionMeta.tone === 'rose'
              ? 'var(--accent-danger)'
              : 'var(--accent-primary)';

        return (
          <section
            key={`${tc.name}-${idx}`}
            className="space-y-3 rounded-xl border p-3.5"
            style={{
              borderColor: 'var(--line-subtle)',
              background: 'var(--bg-page)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {tc.name === 'answer' ? (
                  <Send className="h-3.5 w-3.5" style={{ color: toneColor }} aria-hidden="true" />
                ) : tc.name === 'give_up' ? (
                  <XCircle className="h-3.5 w-3.5" style={{ color: toneColor }} aria-hidden="true" />
                ) : (
                  <Move3d className="h-3.5 w-3.5" style={{ color: toneColor }} aria-hidden="true" />
                )}
                <span className="text-xs font-semibold" style={{ color: 'var(--ink-primary)' }}>
                  {actionMeta.title}
                </span>
              </div>
              <code
                className="font-mono-metric rounded px-1.5 py-0.5 text-[10.5px]"
                style={{ background: 'var(--bg-subtle)', color: 'var(--ink-muted)' }}
              >
                {tc.name}
              </code>
            </div>

            {showNote ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                {tc.note}
              </p>
            ) : null}

            {showReason ? (
              <p
                className="rounded-lg p-2.5 text-xs leading-relaxed"
                style={{
                  background: 'color-mix(in srgb, var(--accent-danger) 8%, transparent)',
                  color: 'var(--ink-primary)',
                }}
              >
                {tc.reason}
              </p>
            ) : null}

            {/* Clean Motion Digest Pills (Only Non-Trivial Movements) */}
            {arms && (arms.left.length > 0 || arms.right.length > 0) ? (
              <div className="space-y-2.5">
                <div className="space-y-2">
                  {[
                    {
                      label: lang === 'en' ? 'Left Arm' : '左臂',
                      chips: leftChips,
                      hasData: arms.left.length > 0,
                    },
                    {
                      label: lang === 'en' ? 'Right Arm' : '右臂',
                      chips: rightChips,
                      hasData: arms.right.length > 0,
                    },
                  ]
                    .filter((side) => side.hasData)
                    .map((side) => (
                      <div key={side.label} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className="w-16 shrink-0 text-[11px] font-semibold"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          {side.label}
                        </span>
                        {side.chips.length > 0 ? (
                          side.chips.map((chip) => (
                            <span
                              key={chip.label}
                              className="font-mono-metric rounded-md px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                background: chip.highlight ? 'var(--accent-soft)' : 'var(--bg-surface)',
                                color: chip.highlight ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                                border: '1px solid var(--line-subtle)',
                              }}
                            >
                              {chip.label}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                            {lang === 'en' ? 'Hold pose' : '保持原位'}
                          </span>
                        )}
                      </div>
                    ))}
                </div>

                {/* Collapsible Full 14-DoF Coordinate Table */}
                <details className="group">
                  <summary
                    className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium select-none hover:underline"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    <ChevronDown
                      className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                    <span>
                      {lang === 'en'
                        ? 'Inspect full 14-DoF TCP targets'
                        : '展开完整 14 维末端目标坐标'}
                    </span>
                  </summary>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {[
                      { label: lang === 'en' ? 'Left TCP' : '左臂末端', rows: arms.left },
                      { label: lang === 'en' ? 'Right TCP' : '右臂末端', rows: arms.right },
                    ]
                      .filter((side) => side.rows.length > 0)
                      .map((side) => (
                        <div
                          key={side.label}
                          className="rounded-lg border p-2.5"
                          style={{
                            borderColor: 'var(--line-subtle)',
                            background: 'var(--bg-surface)',
                          }}
                        >
                          <div
                            className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide"
                            style={{ color: 'var(--ink-muted)' }}
                          >
                            {side.label}
                          </div>
                          <div className="space-y-1">
                            {side.rows.map((r) => {
                              const moved = r.delta !== undefined && Math.abs(r.delta) >= 0.005;
                              return (
                                <div
                                  key={r.dim}
                                  className="font-mono-metric flex items-center justify-between text-[11px]"
                                >
                                  <span style={{ color: 'var(--ink-muted)' }}>{r.dim}</span>
                                  <span>
                                    <strong className="font-medium">
                                      {formatDimValue(r.dim, r.val)}
                                    </strong>
                                    {r.delta !== undefined ? (
                                      <span
                                        className="ml-1 text-[10.5px]"
                                        style={{
                                          color: moved ? 'var(--accent-primary)' : 'var(--ink-muted)',
                                        }}
                                      >
                                        ({formatDelta(r.dim, r.delta)})
                                      </span>
                                    ) : null}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                </details>
              </div>
            ) : null}

            {/* Submitted QA Answers */}
            {tc.answers ? (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {Object.entries(tc.answers).map(([k, v]) => (
                  <div
                    key={k}
                    className="font-mono-metric flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{
                      borderColor: 'var(--line-subtle)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <span className="truncate pr-2" style={{ color: 'var(--ink-secondary)' }}>
                      {humanizeAnswerKey(k)}
                    </span>
                    <strong className="shrink-0 font-bold" style={{ color: 'var(--accent-emerald)' }}>
                      {String(v)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Integrated Compact Planner & Feedback Footer (only on last tool call) */}
            {idx === round.tool_calls.length - 1 && (allPlannedOk || hasDiagnostics) ? (
              <div
                className="border-t pt-2.5 text-[11.5px]"
                style={{ borderColor: 'var(--line-subtle)' }}
              >
                {hasDiagnostics ? (
                  <div
                    className="space-y-1.5 rounded-lg p-2.5"
                    style={{
                      background: 'color-mix(in srgb, var(--accent-danger) 8%, transparent)',
                      color: 'var(--ink-primary)',
                    }}
                  >
                    {failedPlans.length > 0 ? (
                      <div className="font-mono-metric flex flex-wrap gap-1.5 text-[11px]">
                        {round.planning.map((p, i) => (
                          <span
                            key={`${p.arm}-${i}`}
                            className="rounded px-1.5 py-0.5 font-medium"
                            style={{
                              background:
                                p.status === 'Success'
                                  ? 'color-mix(in srgb, var(--accent-emerald) 14%, transparent)'
                                  : 'color-mix(in srgb, var(--accent-danger) 16%, transparent)',
                              color:
                                p.status === 'Success'
                                  ? 'var(--accent-emerald)'
                                  : 'var(--accent-danger)',
                            }}
                          >
                            cuRobo {p.arm}: {p.status}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {errorFeedback.map((fb, i) => (
                      <p key={i} className="leading-relaxed">
                        <strong
                          className="font-mono-metric mr-1 uppercase"
                          style={{ color: 'var(--accent-danger)' }}
                        >
                          {fb.status}:
                        </strong>
                        {fb.message}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    style={{ color: 'var(--accent-emerald)' }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="font-medium">
                      {lang === 'en'
                        ? `cuRobo planned (${round.planning.map((p) => p.arm).join(' + ')}) · ${round.executed_steps} steps executed`
                        : `cuRobo 规划成功（${round.planning.map((p) => p.arm).join(' + ')}）· 执行 ${round.executed_steps} 步`}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        );
      })}

      {/* 3. High-Res Camera Keyframes (Compact Strip Below Narrative) */}
      {activeImages.length > 0 ? (
        <section className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ink-muted)' }}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'en' ? 'Camera Keyframes' : '三视角关键帧'}</span>
            </h3>

            {round.after_images.length > 0 ? (
              <div
                className="inline-flex rounded-full border p-0.5 text-[11px]"
                style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-subtle)' }}
                role="group"
                aria-label={lang === 'en' ? 'Observation timing' : '观测时机'}
              >
                <button
                  type="button"
                  aria-pressed={!showAfter}
                  onClick={() => setShowAfter(false)}
                  className="rounded-full px-2.5 py-0.5 font-medium transition-colors"
                  style={{
                    background: !showAfter ? 'var(--bg-surface)' : 'transparent',
                    color: !showAfter ? 'var(--ink-primary)' : 'var(--ink-muted)',
                  }}
                >
                  {lang === 'en' ? 'Before' : '执行前'}
                </button>
                <button
                  type="button"
                  aria-pressed={showAfter}
                  onClick={() => setShowAfter(true)}
                  className="rounded-full px-2.5 py-0.5 font-medium transition-colors"
                  style={{
                    background: showAfter ? 'var(--bg-surface)' : 'transparent',
                    color: showAfter ? 'var(--ink-primary)' : 'var(--ink-muted)',
                  }}
                >
                  {lang === 'en' ? 'After' : '执行后'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {activeImages.map((img) => {
              const url = episodeAssetUrl(basePath, img.path);
              if (!url) return null;
              const camLabel = CAMERA_LABELS[img.camera]?.[lang] ?? img.camera;
              return (
                <button
                  key={`${img.camera}-${img.path}`}
                  type="button"
                  onClick={() =>
                    setLightbox({ src: url, label: `Round ${round.round} · ${camLabel}` })
                  }
                  className="group relative overflow-hidden rounded-lg border text-left transition-transform hover:scale-[1.01]"
                  style={{ borderColor: 'var(--line-subtle)', background: '#0b1018' }}
                >
                  <img
                    src={url}
                    alt={camLabel}
                    width={640}
                    height={480}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-medium text-slate-200 backdrop-blur-sm">
                    {camLabel}
                  </span>
                  <span className="absolute right-1.5 top-1.5 rounded bg-slate-950/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <ZoomIn className="h-3 w-3" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <ModalDialog
        open={lightbox !== null}
        title={lightbox?.label ?? ''}
        onClose={() => setLightbox(null)}
      >
        {lightbox ? (
          <img
            src={lightbox.src}
            alt={lightbox.label}
            className="mx-auto max-h-[75dvh] w-auto rounded-lg object-contain"
          />
        ) : null}
      </ModalDialog>
    </div>
  );
}
