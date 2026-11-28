import type { PageRoute, Protocol } from '../types/benchmark';

export function parseHashRoute(hash: string): PageRoute {
  const cleaned = (hash || '#/').replace(/^#/, '') || '/';
  const [rawPath, rawQuery = ''] = cleaned.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const query = new URLSearchParams(rawQuery);
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) {
    return { page: 'home' };
  }
  if (parts[0] === 'leaderboard') {
    const tab = query.get('tab');
    const validTab =
      tab === 'matrix' || tab === 'cross-platform' || tab === 'main'
        ? tab
        : undefined;
    return { page: 'leaderboard', tab: validTab };
  }
  if (parts[0] === 'explorer') {
    return { page: 'explorer', query };
  }
  if (parts[0] === 'compare') {
    const task = query.get('task');
    const lm = query.get('lm');
    const rawLp = query.get('lp');
    const mode = query.get('mode');
    const lp: Protocol =
      rawLp === 'qa' || rawLp === 'execution'
        ? rawLp
        : mode === 'cross-model'
          ? 'execution'
          : 'qa';
    const seedRaw = query.get('seed');
    const seedVal = seedRaw !== null && /^\d+$/.test(seedRaw) ? Number(seedRaw) : NaN;
    if (task && lm) {
      return {
        page: 'trajectory',
        modelId: lm,
        protocol: lp,
        taskId: task,
        seed: Number.isSafeInteger(seedVal) && seedVal >= 100 && seedVal <= 109 ? seedVal : 100,
      };
    }
    return { page: 'explorer', query: new URLSearchParams() };
  }
  if (parts[0] === 'trajectory' && parts.length >= 5) {
    let modelId: string;
    let taskId: string;
    try {
      modelId = decodeURIComponent(parts[1]);
      taskId = decodeURIComponent(parts[3]);
    } catch {
      return { page: 'home' };
    }
    const protocol: Protocol = parts[2] === 'qa' ? 'qa' : 'execution';
    const seedNum = Number(parts[4].replace(/^seed-/, ''));
    const roundParam = Number(query.get('round'));
    const round = Number.isSafeInteger(roundParam) && roundParam > 0 ? roundParam : undefined;
    return {
      page: 'trajectory',
      modelId,
      protocol,
      taskId,
      seed: Number.isFinite(seedNum) ? seedNum : 100,
      round,
    };
  }

  return { page: 'home' };
}

export function buildTrajectoryHref(
  modelId: string,
  protocol: Protocol,
  taskId: string,
  seed: number,
  round?: number,
): string {
  const base = `#/trajectory/${encodeURIComponent(modelId)}/${protocol}/${encodeURIComponent(taskId)}/seed-${seed}`;
  return round ? `${base}?round=${round}` : base;
}

export function buildExplorerHref(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== false) {
      sp.set(k, String(v));
    }
  }
  const q = sp.toString();
  return q ? `#/explorer?${q}` : '#/explorer';
}

export function navigate(href: string): void {
  if (window.location.hash === href) return;
  window.location.hash = href;
}
