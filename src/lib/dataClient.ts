import type { EpisodeSummary, IndexPayload, Protocol, TimelineDocument } from '../types/benchmark';

const MEDIA_BASE_RAW = (import.meta.env.VITE_MEDIA_BASE_URL as string | undefined)?.trim() || '';
export const REMOTE_MEDIA_BASE = MEDIA_BASE_RAW.replace(/\/+$/, '');

let indexCache: Promise<IndexPayload> | null = null;
const timelineCache = new Map<string, Promise<TimelineDocument | null>>();

export function fetchIndex(): Promise<IndexPayload> {
  if (!indexCache) {
    indexCache = fetch('./data/index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load index.json (${res.status})`);
        return res.json() as Promise<IndexPayload>;
      })
      .catch((err) => {
        indexCache = null;
        throw err;
      });
  }
  return indexCache;
}

export function episodeBasePath(
  modelId: string,
  protocol: Protocol,
  taskId: string,
  seed: number,
  bundled: boolean,
): string | null {
  const rel = `episodes/${modelId}/${protocol}/${taskId}/seed-${seed}`;
  if (bundled) {
    return `./data/${rel}`;
  }
  if (REMOTE_MEDIA_BASE) {
    return `${REMOTE_MEDIA_BASE}/${rel}`;
  }
  return null;
}

export function episodeAssetUrl(
  basePath: string | null,
  relativeFile: string | null | undefined,
): string | null {
  if (!basePath || !relativeFile) return null;
  return `${basePath}/${relativeFile.replace(/^\/+/, '')}`;
}

export function episodePosterUrl(ep: EpisodeSummary): string {
  const base = episodeBasePath(ep.model_id, ep.protocol, ep.task_id, ep.seed, ep.bundled);
  if (base) {
    return `${base}/poster.jpg`;
  }
  return taskPosterUrl(ep.task_id);
}

export function taskPosterUrl(taskId: string): string {
  return `./images/tasks/${taskId}.jpg`;
}

export function setTaskPosterFallback(img: HTMLImageElement, taskId: string) {
  const fallback = taskPosterUrl(taskId);
  if (img.getAttribute('src') !== fallback) img.src = fallback;
}

export function isEpisodePlayable(ep: EpisodeSummary): boolean {
  return ep.has_video && (ep.bundled || Boolean(REMOTE_MEDIA_BASE));
}

export function fetchTimeline(
  modelId: string,
  protocol: Protocol,
  taskId: string,
  seed: number,
  bundled: boolean,
): Promise<TimelineDocument | null> {
  const base = episodeBasePath(modelId, protocol, taskId, seed, bundled);
  if (!base) {
    return Promise.resolve(null);
  }
  const key = `${base}/timeline.json`;
  const cached = timelineCache.get(key);
  if (cached) return cached;

  const req = fetch(key)
    .then((res) => {
      if (!res.ok) return null;
      return res.json() as Promise<TimelineDocument>;
    })
    .catch(() => null)
    .then((doc) => {
      if (!doc) timelineCache.delete(key);
      return doc;
    });

  timelineCache.set(key, req);
  return req;
}

export function makeEpisodeId(modelId: string, protocol: Protocol, taskId: string, seed: number): string {
  return `${modelId}__${protocol}__${taskId}__seed-${seed}`;
}
