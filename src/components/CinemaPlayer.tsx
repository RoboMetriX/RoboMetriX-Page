import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { TimelineRound } from '../types/benchmark';

interface CinemaPlayerProps {
  videoUrl: string | null;
  posterUrl?: string | null;
  fallbackPosterUrl?: string;
  controlDtS: number;
  rounds: TimelineRound[];
  activeRound: number;
  onSelectRound: (roundNumber: number) => void;
  seekRequest?: { round: TimelineRound } | null;
  onPlaybackChange?: () => void;
  title?: string;
  externalVideoRef?: React.RefObject<HTMLVideoElement | null>;
  lazy?: boolean;
  compact?: boolean;
  keyboardShortcuts?: boolean;
}

const SPEEDS = [0.5, 1, 2];

function seekVideo(video: HTMLVideoElement, time: number) {
  video.currentTime = Math.max(
    0,
    Number.isFinite(video.duration) ? Math.min(time, video.duration) : time,
  );
}

export function CinemaPlayer({
  videoUrl,
  posterUrl,
  fallbackPosterUrl,
  controlDtS,
  rounds,
  activeRound,
  onSelectRound,
  seekRequest,
  onPlaybackChange,
  title,
  externalVideoRef,
  lazy = false,
  compact = false,
  keyboardShortcuts = false,
}: CinemaPlayerProps) {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalVideoRef ?? internalRef;

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [failedPoster, setFailedPoster] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [hoveredRound, setHoveredRound] = useState<TimelineRound | null>(null);
  const roundSelection = useRef(activeRound);
  const selectedStep = useRef<number | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const errorRounds = useMemo(
    () => rounds.filter((r) => r.has_error).map((r) => r.round),
    [rounds],
  );

  useEffect(() => {
    roundSelection.current = activeRound;
  }, [activeRound]);

  useEffect(() => {
    if (!posterUrl || !fallbackPosterUrl || posterUrl === fallbackPosterUrl) return;
    const image = new Image();
    image.onerror = () => setFailedPoster(posterUrl);
    image.src = posterUrl;
    return () => {
      image.onerror = null;
    };
  }, [posterUrl, fallbackPosterUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let frameHandle: number | null = null;
    const syncFromTime = (mediaTime: number) => {
      if (video.seeking || pendingSeek.current !== null) return;
      setCurrentTime(mediaTime);
      const step = Math.max(0, Math.floor(mediaTime / controlDtS + 0.0001));
      setCurrentStep(step);
      if (selectedStep.current !== null) {
        if (step === selectedStep.current) return;
        selectedStep.current = null;
      }
      let matched = false;
      for (let i = rounds.length - 1; i >= 0; i--) {
        const r = rounds[i];
        if (r.executed_steps > 0 && step >= r.start_step && step <= r.end_step) {
          matched = true;
          if (r.round !== roundSelection.current) {
            roundSelection.current = r.round;
            onSelectRound(r.round);
          }
          break;
        }
      }
      if (!matched && step === 0 && rounds.length > 0 && roundSelection.current !== rounds[0].round) {
        roundSelection.current = rounds[0].round;
        onSelectRound(rounds[0].round);
      }
    };

    const onFrame: VideoFrameRequestCallback = (_now, meta) => {
      frameHandle = null;
      syncFromTime(meta.mediaTime);
      requestFrame();
    };
    const requestFrame = () => {
      if (frameHandle === null && !video.paused && !video.ended && !video.error) {
        frameHandle = video.requestVideoFrameCallback?.(onFrame) ?? null;
      }
    };
    const cancelFrame = () => {
      if (frameHandle !== null) video.cancelVideoFrameCallback?.(frameHandle);
      frameHandle = null;
    };
    const onPlayback = () => {
      const isPlaying = !video.paused && !video.ended && !video.error;
      setPlaying(isPlaying);
      setVideoFailed(Boolean(video.error));
      onPlaybackChange?.();
      if (isPlaying) requestFrame();
      else {
        cancelFrame();
        if (video.readyState > 0) syncFromTime(video.currentTime);
      }
    };
    const onTimeUpdate = () => {
      if (frameHandle === null || video.paused) syncFromTime(video.currentTime);
    };
    const onSeeked = () => syncFromTime(video.currentTime);
    const onLoaded = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      if (pendingSeek.current !== null) {
        seekVideo(video, pendingSeek.current);
        pendingSeek.current = null;
        setCurrentTime(video.currentTime);
        const clampedStep = Math.max(0, Math.floor(video.currentTime / controlDtS + 0.0001));
        selectedStep.current = clampedStep;
        setCurrentStep(clampedStep);
      }
    };

    const playbackEvents = ['play', 'pause', 'ended', 'error', 'emptied'];
    playbackEvents.forEach((event) => video.addEventListener(event, onPlayback));
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadedmetadata', onLoaded);
    if (video.readyState > 0) onLoaded();
    onPlayback();

    return () => {
      playbackEvents.forEach((event) => video.removeEventListener(event, onPlayback));
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', onLoaded);
      cancelFrame();
    };
  }, [controlDtS, onPlaybackChange, onSelectRound, rounds, videoRef, videoUrl]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches && videoRef.current) {
      videoRef.current.pause();
    }
  }, [videoRef]);

  const seekToRound = useCallback(
    (roundObj: TimelineRound) => {
      roundSelection.current = roundObj.round;
      onSelectRound(roundObj.round);
      const video = videoRef.current;
      if (!video || video.error) return;
      const targetTime = (roundObj.start_step + 0.5) * controlDtS;
      if (video.readyState === 0) {
        selectedStep.current = roundObj.start_step;
        pendingSeek.current = targetTime;
        setCurrentStep(roundObj.start_step);
      } else {
        seekVideo(video, targetTime);
        setCurrentTime(video.currentTime);
        const clampedStep = Math.max(0, Math.floor(video.currentTime / controlDtS + 0.0001));
        selectedStep.current = clampedStep;
        setCurrentStep(clampedStep);
      }
    },
    [controlDtS, onSelectRound, videoRef],
  );

  useEffect(() => {
    if (seekRequest) seekToRound(seekRequest.round);
  }, [seekRequest, seekToRound]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || video.error) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const onPlayerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target !== event.currentTarget ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      document.querySelector('dialog[open]')
    ) {
      return;
    }
    if (event.key === ' ' && videoRef.current && !videoFailed) {
      event.preventDefault();
      if (!event.repeat) togglePlay();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const next = rounds.find(
        (round) => round.round === activeRound + (event.key === 'ArrowLeft' ? -1 : 1),
      );
      if (next) {
        event.preventDefault();
        seekToRound(next);
      }
    }
  };

  const changeSpeed = (rate: number) => {
    setSpeed(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const replayActiveRound = () => {
    const r = rounds.find((item) => item.round === activeRound);
    if (!r) return;
    seekToRound(r);
    videoRef.current?.play().catch(() => {});
  };

  const stepRound = (delta: number) => {
    const next = rounds.find((r) => r.round === activeRound + delta);
    if (next) seekToRound(next);
  };

  const jumpNextError = () => {
    if (errorRounds.length === 0) return;
    const nextNum = errorRounds.find((n) => n > activeRound) ?? errorRounds[0];
    const target = rounds.find((r) => r.round === nextNum);
    if (target) seekToRound(target);
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {});
    }
  };

  const denseTimeline = rounds.length > 20;

  return (
    <div
      className="cinema-stage overflow-hidden rounded-2xl shadow-lg"
      tabIndex={keyboardShortcuts ? 0 : undefined}
      role={keyboardShortcuts ? 'group' : undefined}
      aria-label={keyboardShortcuts ? title : undefined}
      aria-keyshortcuts={keyboardShortcuts ? 'Space ArrowLeft ArrowRight' : undefined}
      onKeyDown={keyboardShortcuts ? onPlayerKeyDown : undefined}
    >
      {/* Clean Full-Bleed 3-Camera Viewport (Zero Redundant Title Chrome) */}
      <div className="relative aspect-[1280/672] w-full bg-[#06090f]">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl && failedPoster !== posterUrl ? posterUrl : fallbackPosterUrl}
            width={1280}
            height={672}
            playsInline
            preload="metadata"
            {...(lazy ? ({ loading: 'lazy' } as Record<string, string>) : {})}
            onClick={togglePlay}
            className={videoFailed ? 'hidden' : 'h-full w-full cursor-pointer object-contain'}
          />
        ) : null}
        {!videoUrl || videoFailed ? (
          <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-slate-400">
            Video unavailable
          </div>
        ) : null}
      </div>

      {/* Sleek Controls + Zero-Overflow Segmented Round Timeline */}
      <div className={`space-y-3 border-t border-slate-800/80 ${compact ? 'px-3 py-2.5' : 'px-4 py-3.5'}`}>
        {/* Transport Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!videoUrl || videoFailed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
            aria-label={playing ? 'Pause video' : 'Play video'}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-0.5" />}
          </button>

          <button
            type="button"
            onClick={replayActiveRound}
            disabled={!videoUrl || videoFailed}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-700/90 bg-slate-900 px-2.5 text-[11px] font-medium text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-40"
            title="Replay active round"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span className="font-mono-metric">R{String(activeRound).padStart(2, '0')}</span>
          </button>

          <div className="relative flex flex-1 items-center">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={controlDtS}
              value={currentTime}
              disabled={!videoUrl || videoFailed || duration === 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                selectedStep.current = null;
                if (videoRef.current) seekVideo(videoRef.current, v);
                setCurrentTime(v);
              }}
              aria-label="Video playback position"
              className="h-1.5 w-full cursor-pointer accent-sky-400"
            />
          </div>

          <span className="font-mono-metric text-[11px] text-slate-300">
            {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
            <span className="ml-2 hidden text-slate-500 sm:inline">Step {currentStep}</span>
          </span>

          <div className="flex items-center rounded-full border border-slate-800 bg-slate-950 p-0.5">
            {SPEEDS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => changeSpeed(rate)}
                className={`font-mono-metric rounded-full px-2 py-0.5 text-[10.5px] transition-colors ${
                  speed === rate ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rate}×
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleFullscreen}
            disabled={!videoUrl || videoFailed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-40"
            aria-label="Fullscreen video"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Zero-Overflow Segmented Round Timeline */}
        {rounds.length > 0 ? (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex min-w-0 items-center gap-2 text-slate-400">
                <span className="font-mono-metric font-semibold text-slate-200">
                  Round {String(activeRound).padStart(2, '0')} / {String(rounds.length).padStart(2, '0')}
                </span>
                {hoveredRound ? (
                  <span className="font-mono-metric truncate text-sky-300">
                    → R{String(hoveredRound.round).padStart(2, '0')} ·{' '}
                    {hoveredRound.tool_calls[0]?.name ?? hoveredRound.status}
                    {hoveredRound.has_error ? ' (Error)' : ''}
                  </span>
                ) : (
                  <span className="hidden text-slate-500 sm:inline">
                    Click any segment or press ← / →
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {errorRounds.length > 0 ? (
                  <button
                    type="button"
                    onClick={jumpNextError}
                    className="inline-flex h-6 items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 text-[10.5px] font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
                  >
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    <span>
                      Errors ({errorRounds.length})
                    </span>
                  </button>
                ) : null}

                <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950 p-0.5">
                  <button
                    type="button"
                    disabled={activeRound <= 1}
                    onClick={() => stepRound(-1)}
                    aria-label="Previous round"
                    className="inline-flex h-5 w-6 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={activeRound >= rounds.length}
                    onClick={() => stepRound(1)}
                    aria-label="Next round"
                    className="inline-flex h-5 w-6 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-30"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Full-Width Proportional Segments (Roving Tabindex, Zero Overflow even at 69 Rounds) */}
            <div
              className="flex w-full items-center gap-[3px]"
              role="group"
              aria-label="Round timeline"
            >
              {rounds.map((r, idx) => {
                const isActive = r.round === activeRound;
                const isTerminal = r.tool_calls.some(
                  (c) => c.name === 'done' || c.name === 'answer',
                );
                const bgClass = isActive
                  ? 'bg-sky-400 text-slate-950 ring-2 ring-sky-300/70'
                  : r.has_error
                    ? 'bg-rose-500/65 text-rose-100 hover:bg-rose-400'
                    : isTerminal
                      ? 'bg-emerald-500/70 text-emerald-50 hover:bg-emerald-400'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-500';

                const onSegmentKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
                  let targetIdx: number | null = null;
                  if (event.key === 'ArrowLeft') targetIdx = Math.max(0, idx - 1);
                  else if (event.key === 'ArrowRight') targetIdx = Math.min(rounds.length - 1, idx + 1);
                  else if (event.key === 'Home') targetIdx = 0;
                  else if (event.key === 'End') targetIdx = rounds.length - 1;
                  if (targetIdx !== null && targetIdx !== idx) {
                    event.preventDefault();
                    seekToRound(rounds[targetIdx]);
                    segmentRefs.current[targetIdx]?.focus();
                  }
                };

                return (
                  <button
                    key={r.round}
                    ref={(el) => {
                      segmentRefs.current[idx] = el;
                    }}
                    type="button"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => seekToRound(r)}
                    onKeyDown={onSegmentKeyDown}
                    onMouseEnter={() => setHoveredRound(r)}
                    onMouseLeave={() => setHoveredRound(null)}
                    onFocus={() => setHoveredRound(r)}
                    onBlur={() => setHoveredRound(null)}
                    aria-label={`Round ${r.round}${r.has_error ? ', error' : ''}`}
                    aria-current={isActive ? 'step' : undefined}
                    title={`Round ${r.round} · Step ${r.start_step}–${r.end_step} · ${r.tool_calls[0]?.name ?? r.status}`}
                    className={`font-mono-metric min-w-0 flex-1 transition-colors ${
                      denseTimeline
                        ? 'h-3.5 rounded-[2.5px]'
                        : 'h-6 rounded text-[10.5px] font-semibold'
                    } ${bgClass}`}
                  >
                    {denseTimeline ? null : r.round}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
