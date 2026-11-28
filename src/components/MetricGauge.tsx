import type { CSSProperties } from 'react';

export function scoreColor(score: number): string {
  if (score >= 80) return 'var(--accent-emerald)';
  if (score >= 45) return 'var(--accent-primary)';
  if (score >= 15) return 'var(--accent-amber)';
  return 'var(--accent-danger)';
}

export function scoreBadgeStyle(score: number): CSSProperties {
  if (score >= 80) {
    return {
      background: 'color-mix(in srgb, var(--accent-emerald) 13%, transparent)',
      color: 'var(--accent-emerald)',
    };
  }
  if (score >= 45) {
    return {
      background: 'var(--accent-soft)',
      color: 'var(--accent-primary)',
    };
  }
  if (score >= 15) {
    return {
      background: 'color-mix(in srgb, var(--accent-amber) 13%, transparent)',
      color: 'var(--accent-amber)',
    };
  }
  return {
    background: 'color-mix(in srgb, var(--accent-danger) 11%, transparent)',
    color: 'var(--accent-danger)',
  };
}

export function humanizeMetricField(field: string): string {
  let clean = field
    .replace(/_(cm3|cm2|cm|deg|mm|m)$/, '')
    .replace(/_absolute_error$/, ' error')
    .replace(/_position_error$/, ' position err')
    .replace(/_height_error$/, ' height err')
    .replace(/_error$/, ' error');

  clean = clean.replace(/^target_(\d+)/, (_m, n) => `Target ${Number(n) + 1}`);
  clean = clean.replace(/^lane_(\d+)/, (_m, n) => `Lane ${n}`);
  clean = clean.replace(/^item_(\d+)/, (_m, n) => `Item ${n}`);
  clean = clean.replace(/^block_(\d+)/, (_m, n) => `Block ${n}`);

  return clean
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\bXy\b/g, 'XY')
    .replace(/\bY\b/g, 'Y')
    .replace(/\bErr\b/g, 'Error');
}

export function humanizeConstraint(obj: string, cond: string): string {
  const cleanObj = obj
    .replace(/^doll_(\d+)$/, (_m, n) => `Doll ${Number(n) + 1}`)
    .replace(/^target_(\d+)$/, (_m, n) => `Target ${Number(n) + 1}`)
    .replace(/^object_(\d+)$/, (_m, n) => `Object ${Number(n) + 1}`)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const cleanCond = cond
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (cleanObj.toLowerCase() === 'tower' && cleanCond.toLowerCase().includes('tower')) {
    return cleanCond;
  }
  if (cleanObj.toLowerCase() === 'object' || cleanObj.toLowerCase() === 'scene' || cleanObj.toLowerCase() === 'global') {
    return cleanCond;
  }
  return `${cleanObj}: ${cleanCond}`;
}

export function ScoreBar({
  score,
  compact = false,
  darkSurface = false,
  label = 'Benchmark score',
}: {
  score: number;
  compact?: boolean;
  darkSurface?: boolean;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const barColor = darkSurface
    ? clamped >= 80
      ? '#34d399'
      : clamped >= 45
        ? '#60a5fa'
        : clamped >= 15
          ? '#fbbf24'
          : '#f87171'
    : scoreColor(clamped);

  return (
    <div className={compact ? 'flex items-center gap-2' : 'space-y-1'}>
      <div
        className={`metric-ruler-ticks relative overflow-hidden rounded-full ${compact ? 'h-2 w-20' : 'h-2 w-full'}`}
        style={{
          backgroundColor: darkSurface ? 'rgba(148, 163, 184, 0.18)' : 'var(--bg-subtle)',
        }}
        role="meter"
        aria-label={label}
        aria-valuenow={Number(clamped.toFixed(1))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${clamped}%`, backgroundColor: barColor }}
        />
      </div>
      {compact ? (
        <span
          className="font-mono-metric text-xs font-semibold"
          style={{ color: barColor }}
        >
          {score.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}

export function ErrorRulerBar({
  label,
  error,
  cutoff,
  unit,
  componentScore,
  darkSurface = false,
}: {
  label: string;
  error: number | null;
  cutoff: number;
  unit: string;
  componentScore?: number;
  darkSurface?: boolean;
}) {
  const ratio = error === null ? 1 : Math.min(1, error / cutoff);
  const passed = error !== null && error < cutoff;
  const barStyle: CSSProperties = {
    width: `${Math.max(2, ratio * 100)}%`,
    backgroundColor:
      error === null
        ? '#94a3b8'
        : error <= cutoff * 0.2
          ? darkSurface
            ? '#34d399'
            : 'var(--accent-emerald)'
          : passed
            ? darkSurface
              ? '#fbbf24'
              : 'var(--accent-amber)'
            : darkSurface
              ? '#f87171'
              : 'var(--accent-danger)',
  };

  const formattedError =
    error === null
      ? 'N/A'
      : unit === 'cm' && error > 0 && error < 0.1
        ? `${(error * 10).toFixed(2)} mm`
        : `${error.toFixed(error === 0 ? 0 : 3)} ${unit}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span
          className="truncate font-medium"
          style={{ color: darkSurface ? '#cbd5e1' : 'var(--ink-secondary)' }}
          title={label}
        >
          {humanizeMetricField(label)}
        </span>
        <span
          className="font-mono-metric shrink-0 text-[11.5px] font-semibold"
          style={{ color: darkSurface ? '#f8fafc' : 'var(--ink-primary)' }}
        >
          {formattedError}
          <span className="font-normal" style={{ color: darkSurface ? '#64748b' : 'var(--ink-muted)' }}>
            {' '}
            / {cutoff} {unit}
          </span>
          {componentScore !== undefined ? (
            <span className="ml-1.5 font-normal opacity-75">({componentScore.toFixed(0)})</span>
          ) : null}
        </span>
      </div>
      <div
        className="metric-ruler-ticks relative h-1.5 w-full overflow-hidden rounded-full"
        style={{
          backgroundColor: darkSurface ? 'rgba(148, 163, 184, 0.16)' : 'var(--bg-subtle)',
        }}
      >
        <div className="h-full rounded-full" style={barStyle} />
      </div>
    </div>
  );
}
