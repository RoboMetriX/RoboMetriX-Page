import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Pause,
  Play,
} from 'lucide-react';
import type { CategoryId, IndexPayload, Lang } from '../types/benchmark';
import {
  BENCHMARK_COMPARISON,
  CATEGORIES,
  CROSS_PLATFORM_RESULTS,
  CURATED_STRATEGIES,
  GUIDANCE_ABLATION,
  ROBOT_PLATFORMS,
  TASKS,
} from '../data/benchmarkMeta';
import { t } from '../lib/i18n';
import { buildExplorerHref, buildTrajectoryHref } from '../lib/router';
import { ScoreBar } from '../components/MetricGauge';

interface HomePageProps {
  index: IndexPayload;
  lang: Lang;
}

interface HeroSlide {
  id: string;
  tagEn: string;
  tagZh: string;
  titleEn: string;
  titleZh: string;
  subtitleEn: string;
  subtitleZh: string;
  video: string;
  poster: string;
  altEn: string;
  altZh: string;
  primaryCta?: { labelEn: string; labelZh: string; href: string };
  secondaryCta?: { labelEn: string; labelZh: string; href: string };
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'mosaic-20',
    tagEn: '20-TASK LIVE MOSAIC',
    tagZh: '20 任务同步拼接墙',
    titleEn: '20 Parameterized Metric Tasks',
    titleZh: '20 项参数化度量操作任务',
    subtitleEn:
      'Live synchronized rollouts spanning lengths, angles, areas, volumes, and multi-object formations',
    subtitleZh: '覆盖长度、角度、面积、体积与多物体空间队形的同步实测轨迹',
    video: './videos/hero-mosaic-20tasks.mp4',
    poster: './videos/hero-mosaic-20tasks.jpg',
    altEn:
      'A 5-by-4 synchronized video mosaic showing bimanual Franka Panda robot arms executing all 20 RoboMetriX metric manipulation tasks: Stack to Height, Laptop Opening, Length Selection, Arc Slide, Drawer Pulling, Pointer Rotation, Volume Selection, Circular Placement, Rod-Angle Placement, Area Selection, Metric Overhang Push, Rectangle Formation, Height Selection, Surface-Gap Placement, Equal-Spacing Placement, Polar Placement, Linear Sliding, Two-Anchor Placement, Metric-Gap Placement, and Object Pushing.',
    altZh:
      '5×4 同步视频拼接墙，展示双臂 Franka Panda 机器人并行执行全部 20 项 RoboMetriX 度量操作任务：目标高度搭建、笔记本定角开盖、长度选择、圆弧滑块、拉抽屉、指针旋转、体积选择、圆周放置、细杆定角、面积选择、悬空推送、矩形队列摆瓶、高度选择、表面间距放置、等间距排列、极坐标放置、直线滑块、双锚点放置、度量间距放置与物体推移。',
  },
  {
    id: 'execution-quad',
    tagEn: 'METRIC-CONSTRAINED EXECUTION',
    tagZh: '度量约束执行',
    titleEn: 'Sub-Millimeter Control',
    titleZh: '亚毫米级度量控制',
    subtitleEn:
      'Closed-loop physical manipulation under episode-varying numerical goals & hard validity checks',
    subtitleZh: '在回合级变化的数值目标与硬性物理约束下完成闭环操作',
    video: './videos/hero-execution-quad.mp4',
    poster: './videos/hero-execution-quad.jpg',
    altEn:
      'Four-panel synchronized execution showcase of GPT-6 Astra stacking blocks within 0.04 mm of target height, opening a laptop lid to within 0.04 degrees, positioning three objects in a circular formation, and sliding a block along a curved arc.',
    altZh:
      '四分屏同步执行展示：GPT-6 Astra 以 0.04 mm 误差完成目标高度搭建、以 0.04° 误差开启笔记本屏幕、以 0.50 mm 精度完成圆周摆放，以及沿圆弧轨道精确推块。',
    primaryCta: {
      labelEn: 'Inspect Stack to Height in Studio',
      labelZh: '在回放工作室查看搭建轨迹',
      href: buildTrajectoryHref('gpt-6-astra', 'execution', 'stack_to_height', 101),
    },
    secondaryCta: {
      labelEn: 'Open Leaderboard',
      labelZh: '查看执行榜单',
      href: '#/leaderboard',
    },
  },
  {
    id: 'qa-quad',
    tagEn: 'EMBODIED METRIC QA',
    tagZh: '具身度量问答',
    titleEn: 'Active Measurement',
    titleZh: '具身主动测量',
    subtitleEn:
      'Frontier VLMs spontaneously turn robot arms and wrist cameras into physical measuring instruments',
    subtitleZh: '前沿 VLM 自发将双臂与腕部相机转化为物理测距、对齐与参考探针',
    video: './videos/hero-qa-quad.mp4',
    poster: './videos/hero-qa-quad.jpg',
    altEn:
      'Four-panel synchronized Embodied Metric QA showcase where GPT-6 Astra lowers its wrist camera to estimate cuboid volumes, scans screwdrivers for length selection, probes laptop hinge height bimanually, and measures circular anchor coordinates.',
    altZh:
      '四分屏具身度量问答展示：GPT-6 Astra 主动下移腕部相机反推长方体体积、扫描测量螺丝刀长度、双臂协同定位笔记本铰链高度，并测量圆周锚点坐标。',
    primaryCta: {
      labelEn: 'Inspect Volume QA Trajectory',
      labelZh: '查看体积主动测量轨迹',
      href: buildTrajectoryHref('gpt-6-astra', 'qa', 'volume_select', 100),
    },
    secondaryCta: {
      labelEn: 'Inspect Matched Execution',
      labelZh: '查看同场景执行轨迹',
      href: buildTrajectoryHref('gpt-6-astra', 'execution', 'volume_select', 100),
    },
  },
  {
    id: 'paired-gap',
    tagEn: 'PAIRED PROTOCOLS · MATCHED SCENES',
    tagZh: '同场景配对协议对比',
    titleEn: 'Understanding–Execution Gap',
    titleZh: '度量理解与物理执行鸿沟',
    subtitleEn:
      'On identical layouts, GPT-6 Astra scores 83.3 in Metric QA yet drops to 53.2 in closed-loop Execution',
    subtitleZh: '在完全相同的初始场景下，GPT-6 Astra 的 QA 均值达 83.3，但闭环执行降至 53.2',
    video: './videos/hero-paired-split.mp4',
    poster: './videos/hero-paired-split.jpg',
    altEn:
      'Side-by-side matched-scene comparison on Volume Selection seed 100: on the left, GPT-6 Astra accurately measures cuboid volumes in Embodied Metric QA (score 90.0); on the right, independent Execution mis-binds the candidate block and fails (score 0.0).',
    altZh:
      '体积选择 seed-100 同初始场景左右对比：左侧 GPT-6 Astra 在具身度量问答中准确测出长方体体积（90.0 分）；右侧独立执行阶段却选错候选木块放入目标区（0.0 分）。',
    primaryCta: {
      labelEn: 'Inspect Volume Rollout (QA ↔ Exec)',
      labelZh: '查看体积任务配对轨迹',
      href: buildTrajectoryHref('gpt-6-astra', 'qa', 'volume_select', 100),
    },
    secondaryCta: {
      labelEn: 'Inspect Frontier Gap Chart',
      labelZh: '查看鸿沟前沿图',
      href: '#/leaderboard',
    },
  },
];

const BIBTEX_SNIPPET = `@inproceedings{robometrix2027,
  title     = {RoboMetriX: Benchmarking Metric-Constrained Manipulation for Vision-Language Models},
  author    = {Anonymous Authors},
  booktitle = {Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)},
  year      = {2027},
  note      = {Under double-blind review}
}`;

export function HomePage({ index, lang }: HomePageProps) {
  const tr = t(lang);
  const [slideIdx, setSlideIdx] = useState(0);
  const [videoFailed, setVideoFailed] = useState<Record<string, boolean>>({});
  const [isPaused, setIsPaused] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'ALL'>('ALL');
  const [bibCopied, setBibCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const slide = HERO_SLIDES[slideIdx];
  const prevSlide = HERO_SLIDES[(slideIdx - 1 + HERO_SLIDES.length) % HERO_SLIDES.length];
  const nextSlide = HERO_SLIDES[(slideIdx + 1) % HERO_SLIDES.length];

  const visibleTasks =
    selectedCategory === 'ALL' ? TASKS : TASKS.filter((item) => item.category === selectedCategory);

  const stepSlide = (delta: number) => {
    setSlideIdx((prev) => (prev + delta + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const handleCopyBibtex = async () => {
    try {
      await navigator.clipboard.writeText(BIBTEX_SNIPPET);
      setBibCopied(true);
      window.setTimeout(() => setBibCopied(false), 2000);
    } catch {
      setBibCopied(false);
    }
  };

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPaused) {
      vid.pause();
    } else {
      vid.play().catch(() => {});
    }
  }, [isPaused, slideIdx]);

  const showVideo = !videoFailed[slide.id];

  return (
    <div className="pb-24">
      {/* Top Centered Academic Paper Masthead + Colored Scale Strip */}
      <header className="mx-auto max-w-[1380px] px-5 pb-6 pt-8 text-center sm:px-8 sm:pt-10 lg:px-10">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="font-mono-metric inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs uppercase tracking-wider">
            <span style={{ color: 'var(--accent-primary)' }}>CVPR 2027 Submission</span>
            <span style={{ color: 'var(--line-strong)' }}>·</span>
            <span style={{ color: 'var(--ink-muted)' }}>
              {lang === 'en' ? 'Anonymous Authors · Double-Blind Review' : '匿名作者 · 双盲评审版本'}
            </span>
          </div>

          <h1 className="font-display text-3xl font-semibold leading-[1.18] tracking-tight sm:text-4xl lg:text-[2.6rem]">
            {lang === 'en' ? (
              <>
                Robo<span style={{ color: 'var(--accent-primary)' }}>Metri</span>
                <span style={{ color: 'var(--accent-amber)' }}>X</span>: Benchmarking
                Metric-Constrained
                <br className="hidden md:inline" /> Manipulation for Vision-Language Models
              </>
            ) : (
              <>
                Robo<span style={{ color: 'var(--accent-primary)' }}>Metri</span>
                <span style={{ color: 'var(--accent-amber)' }}>X</span>：面向视觉语言模型的
                <br className="hidden md:inline" />
                度量约束机器人操作评测基准
              </>
            )}
          </h1>

          {/* Centered Single-Row Academic Resource Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <a
              href="#/leaderboard"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white no-underline shadow-sm transition-opacity hover:opacity-90"
              style={{ background: '#1a73e8' }}
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'en' ? 'Leaderboard' : '评测榜单'}</span>
            </a>
            <a
              href="#/explorer"
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold no-underline transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                borderColor: 'var(--line-strong)',
                background: 'var(--bg-surface)',
                color: 'var(--ink-primary)',
              }}
            >
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'en' ? '3,600 Trajectories' : '3,600 条轨迹'}</span>
            </a>
            <a
              href="https://github.com/RoboMetriX/RoboMetriX-Page"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold no-underline transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                borderColor: 'var(--line-strong)',
                background: 'var(--bg-surface)',
                color: 'var(--ink-primary)',
              }}
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{lang === 'en' ? 'Code' : '代码仓库'}</span>
            </a>
            <button
              type="button"
              onClick={() => {
                const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'auto'
                  : 'smooth';
                const section = document.getElementById('bibtex');
                section?.scrollIntoView({ behavior, block: 'start' });
                section?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                borderColor: 'var(--line-strong)',
                background: 'var(--bg-surface)',
                color: 'var(--ink-primary)',
              }}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>BibTeX</span>
            </button>
          </div>

          {/* Color-Accented 5-Column Benchmark Scale Strip right above Video */}
          <dl
            className="mx-auto mt-6 grid max-w-4xl grid-cols-2 gap-3 rounded-2xl border px-3 py-4 sm:grid-cols-5 sm:gap-0 sm:divide-x"
            style={{
              borderColor: 'var(--line-subtle)',
              background: 'var(--bg-surface)',
            }}
          >
            {[
              { val: '20', label: tr.kpiTasks, color: 'var(--kpi-1)' },
              { val: '9', label: tr.kpiModels, color: 'var(--kpi-2)' },
              { val: index.total_episodes.toLocaleString(), label: tr.kpiTrajs, color: 'var(--kpi-3)' },
              { val: '6.03B', label: tr.kpiTokens, color: 'var(--kpi-4)' },
              { val: '6', label: tr.kpiRobots, color: 'var(--kpi-5)' },
            ].map((kpi) => (
              <div key={kpi.label} className="px-2" style={{ borderColor: 'var(--line-subtle)' }}>
                <dd
                  className="tabular-nums-clean text-2xl font-bold tracking-tight sm:text-[1.65rem]"
                  style={{ color: kpi.color }}
                >
                  {kpi.val}
                </dd>
                <dt className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                  {kpi.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* Full-Bleed Cinema Peek-Carousel with 20-Task Live Mosaic */}
      <section className="overflow-x-clip pb-8 pt-2" aria-label="Featured RoboMetriX showcase">
        <div className="relative mx-auto flex max-w-[1680px] items-center justify-center px-4 sm:px-6">
          {/* Left Peek Card (XL+) */}
          <button
            type="button"
            onClick={() => stepSlide(-1)}
            aria-label={lang === 'en' ? `Previous slide: ${prevSlide.titleEn}` : `上一项：${prevSlide.titleZh}`}
            className="group relative hidden h-[min(64vh,540px)] w-[11vw] max-w-[160px] shrink-0 -translate-x-5 overflow-hidden rounded-[26px] border shadow-md transition-transform duration-300 hover:scale-[1.02] xl:block"
            style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-surface)' }}
          >
            <img
              src={prevSlide.poster}
              alt=""
              aria-hidden="true"
              width={640}
              height={360}
              className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
          </button>

          {/* Center Flagship Rounded Video Stage */}
          <div className="cinema-stage relative aspect-[16/9] max-h-[590px] w-full max-w-[1220px] shrink-0 overflow-hidden rounded-[26px] shadow-xl">
            {showVideo ? (
              <video
                ref={videoRef}
                key={slide.id}
                src={slide.video}
                poster={slide.poster}
                width={1920}
                height={1080}
                autoPlay={!isPaused}
                loop
                muted
                playsInline
                preload="metadata"
                aria-describedby={`hero-desc-${slide.id}`}
                onError={() => setVideoFailed((prev) => ({ ...prev, [slide.id]: true }))}
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={slide.poster}
                alt={lang === 'en' ? slide.altEn : slide.altZh}
                width={1920}
                height={1080}
                className="h-full w-full object-cover"
              />
            )}

            <p id={`hero-desc-${slide.id}`} className="sr-only-status">
              {lang === 'en' ? slide.altEn : slide.altZh}
            </p>

            {/* Clean Zero-Blur Photographic Scrim */}
            <div className="hero-optical-scrim pointer-events-none absolute inset-0" aria-hidden="true" />

            {/* Subtle 4-Corner Optical Calibration Viewfinder Brackets */}
            <div className="pointer-events-none absolute inset-4 sm:inset-6" aria-hidden="true">
              <span className="absolute left-0 top-0 h-4 w-4 border-l border-t border-white/35" />
              <span className="absolute right-0 top-0 h-4 w-4 border-r border-t border-white/35" />
              <span className="absolute bottom-0 left-0 h-4 w-4 border-b border-l border-white/35" />
              <span className="absolute bottom-0 right-0 h-4 w-4 border-b border-r border-white/35" />
            </div>

            {/* Clean Centered Slide Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center sm:px-12">
              <span className="font-mono-metric mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/45 px-3.5 py-1 text-[11px] font-medium tracking-wider text-white/90 backdrop-blur-md">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                <span>{lang === 'en' ? slide.tagEn : slide.tagZh}</span>
              </span>

              <div className="font-display text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
                {lang === 'en' ? slide.titleEn : slide.titleZh}
              </div>

              <p className="mt-3 max-w-3xl text-balance text-sm font-medium leading-relaxed text-white/95 drop-shadow-[0_1px_12px_rgba(0,0,0,0.65)] sm:text-lg">
                {lang === 'en' ? slide.subtitleEn : slide.subtitleZh}
              </p>

              {slide.primaryCta || slide.secondaryCta ? (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {slide.primaryCta ? (
                    <a
                      href={slide.primaryCta.href}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 no-underline shadow-lg transition-colors hover:bg-slate-100"
                    >
                      <span>
                        {lang === 'en' ? slide.primaryCta.labelEn : slide.primaryCta.labelZh}
                      </span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : null}
                  {slide.secondaryCta ? (
                    <a
                      href={slide.secondaryCta.href}
                      className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/45 px-5 py-2.5 text-sm font-semibold text-white no-underline backdrop-blur-md transition-colors hover:bg-slate-950/65"
                    >
                      <span>
                        {lang === 'en' ? slide.secondaryCta.labelEn : slide.secondaryCta.labelZh}
                      </span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Bottom Instrumentation Bar inside Stage (Pause always reachable, WCAG 2.2.2) */}
            <div className="absolute inset-x-4 bottom-3 flex items-center justify-end sm:inset-x-10 sm:bottom-5 sm:justify-between">
              <span className="font-mono-metric hidden text-[11px] tracking-wider text-white/75 sm:inline">
                0{slideIdx + 1} / 0{HERO_SLIDES.length} · CALIBRATED METROLOGY VIEW
              </span>
              {showVideo ? (
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  aria-pressed={isPaused}
                  aria-label={
                    isPaused
                      ? lang === 'en'
                        ? 'Play background showcase video'
                        : '播放背景演示视频'
                      : lang === 'en'
                        ? 'Pause background showcase video'
                        : '暂停背景演示视频'
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/25 bg-slate-950/60 px-3 text-[11px] font-medium text-white backdrop-blur-md transition-colors hover:bg-slate-950/80"
                >
                  {isPaused ? (
                    <>
                      <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                      <span>{lang === 'en' ? 'Play' : '播放'}</span>
                    </>
                  ) : (
                    <>
                      <Pause className="h-3 w-3" aria-hidden="true" />
                      <span>{lang === 'en' ? 'Pause' : '暂停'}</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>

          {/* Right Peek Card (XL+) */}
          <button
            type="button"
            onClick={() => stepSlide(1)}
            aria-label={lang === 'en' ? `Next slide: ${nextSlide.titleEn}` : `下一项：${nextSlide.titleZh}`}
            className="group relative hidden h-[min(64vh,540px)] w-[11vw] max-w-[160px] shrink-0 translate-x-5 overflow-hidden rounded-[26px] border shadow-md transition-transform duration-300 hover:scale-[1.02] xl:block"
            style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-surface)' }}
          >
            <img
              src={nextSlide.poster}
              alt=""
              aria-hidden="true"
              width={640}
              height={360}
              className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-black/20 to-transparent" />
          </button>
        </div>

        {/* Minimal Tactile Pager Strip right underneath the Hero Stage */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => stepSlide(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: 'var(--line-strong)',
              background: 'var(--bg-surface)',
              color: 'var(--ink-primary)',
            }}
            aria-label={lang === 'en' ? 'Previous showcase' : '上一条展示'}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-1" role="group" aria-label="Choose showcase slide">
            {HERO_SLIDES.map((s, idx) => {
              const active = idx === slideIdx;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={
                    lang === 'en'
                      ? `Show slide ${idx + 1}: ${s.titleEn}`
                      : `切换至第 ${idx + 1} 项：${s.titleZh}`
                  }
                  onClick={() => setSlideIdx(idx)}
                  className="inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full px-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span
                    aria-hidden="true"
                    className="block h-2 rounded-full transition-all"
                    style={{
                      width: active ? '28px' : '8px',
                      background: active ? 'var(--ink-primary)' : 'var(--line-strong)',
                    }}
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => stepSlide(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: 'var(--line-strong)',
              background: 'var(--bg-surface)',
              color: 'var(--ink-primary)',
            }}
            aria-label={lang === 'en' ? 'Next showcase' : '下一条展示'}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Main Academic Paper Narrative Sections */}
      <div className="mx-auto max-w-[1380px] space-y-20 border-t px-5 pt-14 sm:px-8 lg:px-10" style={{ borderColor: 'var(--line-subtle)' }}>
        {/* 01 · Abstract & Benchmark Overview Figure */}
        <section id="abstract" className="grid items-start gap-10 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <div className="space-y-2">
              <div className="font-mono-metric text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--accent-primary)' }}>
                01 — {lang === 'en' ? 'Abstract' : '论文摘要'}
              </div>
              <h2 className="font-editorial text-3xl font-semibold tracking-tight">
                {lang === 'en' ? 'Overview & Motivation' : '研究动机与核心贡献'}
              </h2>
            </div>

            <div className="space-y-4 text-[15px] leading-[1.78]" style={{ color: 'var(--ink-secondary)' }}>
              {lang === 'en' ? (
                <>
                  <p>
                    General-purpose vision-language models (VLMs) show promise in robotic manipulation,
                    yet their ability to satisfy explicit metric goals remains largely unexamined.
                    Satisfying such goals requires both{' '}
                    <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      interactive metric reasoning
                    </strong>{' '}
                    to acquire physical measurements and{' '}
                    <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      metric-grounded execution
                    </strong>{' '}
                    to translate them into manipulation outcomes.
                  </p>
                  <p>
                    We introduce{' '}
                    <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      RoboMetriX
                    </strong>
                    , comprising 20 parameterized manipulation tasks with episode-varying numerical
                    constraints on lengths, angles, areas, and volumes. Two paired protocols—Embodied
                    Metric QA and Metric-Constrained Execution—evaluate these capabilities in matched
                    initial scenes across 9 frontier VLMs and 3,600 trajectories (~6.03B tokens).
                  </p>
                </>
              ) : (
                <>
                  <p>
                    通用视觉语言模型（VLM）在机器人操作领域展现出显著潜力，但其在显式数值度量目标上的能力仍缺乏系统评估。完成此类任务同时要求模型具备
                    <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      交互式度量推理
                    </strong>
                    （主动获取物理尺寸、角度与空间坐标）与
                    <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      度量驱动执行
                    </strong>
                    （将测量结果转化为满足物理约束的操作动作）。
                  </p>
                  <p>
                    本文提出{' '}
                    <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      RoboMetriX
                    </strong>
                    ，涵盖长度、角度、面积与体积四类物理量的 20 项参数化操作任务，通过「具身度量问答（Embodied
                    Metric QA）」与「度量约束执行（Metric-Constrained Execution）」双协议在完全一致的初始场景中系统评测
                    9 个前沿 VLM（共 3,600 条轨迹、约 6.03B tokens）。
                  </p>
                </>
              )}
            </div>

            {/* 3 Concise Paper Contributions */}
            <ol className="space-y-3 border-t pt-5" style={{ borderColor: 'var(--line-subtle)' }}>
              {[
                {
                  num: 'C1',
                  en: 'Paired active measurement & variable-goal execution on identical initial scenes to decouple perception from control.',
                  zh: '同初始场景配对评测主动物理测量与动态数值操作，直接剥离感知误差与执行失败。',
                },
                {
                  num: 'C2',
                  en: '3,600-trajectory study uncovering emergent robotic measurement strategies alongside a persistent understanding–execution gap.',
                  zh: '基于 3,600 条完整轨迹揭示 VLM 自发涌现的三类具身测量策略，并量化理解与执行间的显著鸿沟。',
                },
                {
                  num: 'C3',
                  en: 'Unified Isaac Sim 6.0.1 / Isaac Lab 3.0 / cuRobo framework supporting metric-scaled OBJ → USD asset generation and 6 robot platforms.',
                  zh: '基于 Isaac Sim 6.0.1 / Isaac Lab 3.0 与 cuRobo 构建统一多机型评测与物理尺寸资产生成框架。',
                },
              ].map((c) => (
                <li key={c.num} className="flex gap-3 text-sm leading-relaxed">
                  <span
                    className="font-mono-metric mt-0.5 shrink-0 text-xs font-semibold"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    {c.num}
                  </span>
                  <span style={{ color: 'var(--ink-secondary)' }}>
                    {lang === 'en' ? c.en : c.zh}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <figure className="paper-plate overflow-hidden lg:col-span-7">
            <div className="bg-white p-3 sm:p-4">
              <img
                src="./images/overview.jpg"
                alt="Figure 1: Overview of RoboMetriX benchmark, paired evaluation protocols, leaderboard summary across 9 frontier VLMs, and emergent interactive measurement strategies."
                width={1600}
                height={1000}
                className="w-full rounded object-contain"
              />
            </div>
            <figcaption
              className="border-t px-5 py-3.5 text-xs leading-relaxed"
              style={{ borderColor: 'var(--line-subtle)', color: 'var(--ink-secondary)' }}
            >
              <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
                {lang === 'en' ? 'Figure 1.' : '图 1.'}
              </strong>{' '}
              {lang === 'en'
                ? 'Overview of RoboMetriX. Every episode pairs Embodied Metric QA and Metric-Constrained Execution across 20 tasks, revealing emergent measurement strategies and a pronounced gap between metric understanding and closed-loop execution.'
                : 'RoboMetriX 基准总览：涵盖度量约束任务设计、配对评测协议、9 个前沿 VLM 在 3,600 条轨迹上的评测结果，以及模型自发涌现的主动测量策略。'}
            </figcaption>
          </figure>
        </section>

        {/* 02 · Paired Evaluation Protocols, Task Design Figure & Benchmark Comparison Table */}
        <section
          id="protocols"
          className="space-y-10 border-t pt-16"
          style={{ borderColor: 'var(--line-subtle)' }}
        >
          <div className="grid items-start gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-5">
              <div className="space-y-2">
                <div className="font-mono-metric text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--accent-primary)' }}>
                  02 — {lang === 'en' ? 'Methodology' : '评测方法'}
                </div>
                <h2 className="font-editorial text-3xl font-semibold tracking-tight">
                  {tr.sectionWhyTitle}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {tr.sectionWhyLead}
                </p>
              </div>

              {/* Protocol I */}
              <div
                className="paper-plate space-y-2.5 p-5"
                style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--accent-primary)' }}
              >
                <div className="font-mono-metric text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
                  Protocol I · Active Metric Acquisition
                </div>
                <h3 className="text-base font-semibold">{tr.protocolQaTitle}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {tr.protocolQaDesc}
                </p>
                <code
                  className="font-mono-metric block rounded px-3 py-1.5 text-xs"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--ink-primary)' }}
                >
                  S_QA = mean_i [ 100 · max(0, 1 − e_i / τ_i) ]
                </code>
              </div>

              {/* Protocol II */}
              <div
                className="paper-plate space-y-2.5 p-5"
                style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--accent-amber)' }}
              >
                <div className="font-mono-metric text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-amber)' }}>
                  Protocol II · Closed-Loop Physical Control
                </div>
                <h3 className="text-base font-semibold">{tr.protocolExecTitle}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {tr.protocolExecDesc}
                </p>
                <code
                  className="font-mono-metric block rounded px-3 py-1.5 text-xs"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--ink-primary)' }}
                >
                  S_Exec = I[valid] · min_i [ 100 · max(0, 1 − e_i / τ_i) ]
                </code>
              </div>

              <p className="font-mono-metric text-xs" style={{ color: 'var(--ink-muted)' }}>
                {lang === 'en'
                  ? 'Tolerances τ: 1.0 cm (length/distance) · 1.0° (angle) · 2.0 cm² (area) · 5.0 cm³ (volume)'
                  : '物理容差 τ：1.0 cm（长度/位移）· 1.0°（角度）· 2.0 cm²（面积）· 5.0 cm³（体积）'}
              </p>
            </div>

            <figure className="paper-plate overflow-hidden lg:col-span-7">
              <div className="bg-white p-3 sm:p-4">
                <img
                  src="./images/task_design.jpg"
                  alt="Figure 2: Task design across four metric quantity types (length, angle, area, volume), constraint composition, environment metric information acquisition, and metric-grounded manipulation."
                  width={1600}
                  height={1100}
                  loading="lazy"
                  className="w-full rounded object-contain"
                />
              </div>
              <figcaption
                className="border-t px-5 py-3.5 text-xs leading-relaxed"
                style={{ borderColor: 'var(--line-subtle)', color: 'var(--ink-secondary)' }}
              >
                <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
                  {lang === 'en' ? 'Figure 2.' : '图 2.'}
                </strong>{' '}
                {lang === 'en'
                  ? 'Task design in RoboMetriX: metric constraints span four physical quantity types and multi-constraint compositions, requiring online scene measurement followed by verified physical execution.'
                  : 'RoboMetriX 任务构造框架：覆盖四类物理量与复合约束，要求模型在执行前在线观测与测量场景信息，并满足严格的几何与物理有效性校验。'}
              </figcaption>
            </figure>
          </div>

          {/* Table 1: Full-Width Booktabs Benchmark Positioning */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">
                <span className="font-mono-metric mr-2" style={{ color: 'var(--accent-primary)' }}>
                  {lang === 'en' ? 'Table 1.' : '表 1.'}
                </span>
                {lang === 'en'
                  ? 'Comparison with Spatial Reasoning and Embodied Manipulation Benchmarks'
                  : '与现有空间推理及具身操作基准的特性对比'}
              </h3>
              <span className="font-mono-metric text-xs" style={{ color: 'var(--ink-muted)' }}>
                {lang === 'en'
                  ? 'Paired = identical initial scenes for QA & Execution'
                  : 'Paired = QA 与 Execution 在完全一致的初始场景配对'}
              </span>
            </div>

            <div tabIndex={0} role="region" aria-labelledby="bench-compare-caption" className="table-wrapper rounded-lg border" style={{ borderColor: 'var(--line-subtle)' }}>
              <table className="metric-table booktabs-table">
                <caption id="bench-compare-caption" className="sr-only-status">
                  Comparison of RoboMetriX with existing spatial reasoning and manipulation benchmarks
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{lang === 'en' ? 'Benchmark' : '基准名称'}</th>
                    <th scope="col">{lang === 'en' ? 'Paradigm' : '评测范式'}</th>
                    <th scope="col">{lang === 'en' ? 'QA Protocol' : 'QA 协议'}</th>
                    <th scope="col">{lang === 'en' ? 'Numeric Goal' : '数值目标'}</th>
                    <th scope="col">{lang === 'en' ? 'Paired Context' : '配对场景'}</th>
                  </tr>
                </thead>
                <tbody>
                  {BENCHMARK_COMPARISON.map((row) => (
                    <tr
                      key={row.name}
                      style={row.ours ? { background: 'var(--accent-soft)' } : undefined}
                    >
                      <th
                        scope="row"
                        style={
                          row.ours
                            ? { background: 'var(--accent-soft)', color: 'var(--accent-primary)' }
                            : undefined
                        }
                      >
                        {row.name}
                      </th>
                      <td>{lang === 'en' ? row.paradigmEn : row.paradigmZh}</td>
                      <td className="font-mono-metric text-xs">
                        {lang === 'en' ? row.qaEn : row.qaZh}
                      </td>
                      <td className="font-mono-metric text-xs font-medium">
                        {lang === 'en' ? row.numericGoalEn : row.numericGoalZh}
                      </td>
                      <td>
                        {row.paired ? (
                          <Check
                            className="h-4 w-4"
                            style={{ color: 'var(--accent-emerald)' }}
                            aria-label="Yes"
                          />
                        ) : (
                          <span style={{ color: 'var(--ink-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 03 · Empirical Findings from 3,600 Trajectories (Full Visible Academic Spread) */}
        <section
          id="findings"
          className="space-y-12 border-t pt-16"
          style={{ borderColor: 'var(--line-subtle)' }}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <div className="font-mono-metric text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--accent-primary)' }}>
                03 — {lang === 'en' ? 'Empirical Analysis' : '核心实验分析'}
              </div>
              <h2 className="font-editorial text-3xl font-semibold tracking-tight">
                {tr.sectionFindingsTitle}
              </h2>
              <p className="text-sm leading-relaxed sm:text-base" style={{ color: 'var(--ink-secondary)' }}>
                {tr.sectionFindingsLead}
              </p>
            </div>
            <a
              href="#/leaderboard"
              className="inline-flex items-center gap-1.5 text-sm font-semibold no-underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              <span>{lang === 'en' ? 'Explore Full 9-VLM Leaderboard' : '查看全部 9 模型完整榜单'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {/* 3A · Emergent Active Measurement Strategies */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">
              <span className="font-mono-metric mr-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                3.1
              </span>
              {lang === 'en'
                ? 'Emergent Active Measurement Strategies'
                : '前沿 VLM 自发涌现的三类具身主动测量策略'}
            </h3>
            <div className="grid gap-6 lg:grid-cols-3">
              {CURATED_STRATEGIES.map((item) => (
                <article key={item.id} className="paper-plate flex flex-col overflow-hidden">
                  <div className="border-b bg-white p-3" style={{ borderColor: 'var(--line-subtle)' }}>
                    <img
                      src={item.diagram}
                      alt={lang === 'en' ? item.titleEn : item.titleZh}
                      width={1200}
                      height={900}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded object-contain"
                    />
                  </div>
                  <div className="flex flex-1 flex-col space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className="font-mono-metric text-[11px] font-semibold"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        {lang === 'en' ? item.badgeEn : item.badgeZh}
                      </span>
                      <span
                        className="font-mono-metric shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-[10.5px] font-medium"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--ink-primary)' }}
                      >
                        {lang === 'en' ? item.metricChipEn : item.metricChipZh}
                      </span>
                    </div>
                    <h4 className="text-base font-semibold">
                      {lang === 'en' ? item.titleEn : item.titleZh}
                    </h4>
                    <p className="flex-1 text-xs leading-relaxed sm:text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                      {lang === 'en' ? item.summaryEn : item.summaryZh}
                    </p>
                    <code
                      className="font-mono-metric block overflow-x-auto rounded px-3 py-2 text-[11px]"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--ink-primary)' }}
                    >
                      {item.formula}
                    </code>
                    <a
                      href={buildTrajectoryHref(
                        item.modelId,
                        item.protocol,
                        item.taskId,
                        item.seed,
                        item.highlightRound,
                      )}
                      className="inline-flex items-center justify-between border-t pt-3 text-xs font-semibold no-underline"
                      style={{ borderColor: 'var(--line-subtle)', color: 'var(--accent-primary)' }}
                    >
                      <span>
                        {tr.openStudio} · Round {item.highlightRound}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* 3B · Understanding–Execution Gap + Measurement-Guided Intervention */}
          <div className="grid items-stretch gap-8 lg:grid-cols-12">
            {/* Left: Correlation & Matched-Scene Gap */}
            <div className="paper-plate flex flex-col justify-between overflow-hidden lg:col-span-7">
              <div className="border-b px-6 py-4" style={{ borderColor: 'var(--line-subtle)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">
                    <span className="font-mono-metric mr-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                      3.2
                    </span>
                    {lang === 'en'
                      ? 'The Understanding–Execution Gap'
                      : '度量理解与物理执行之间的持续鸿沟'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="font-mono-metric rounded px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent-primary)' }}
                    >
                      Pearson r = 0.92 · ρ = 0.87
                    </span>
                    <span
                      className="font-mono-metric rounded px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: 'rgba(197, 34, 31, 0.1)', color: 'var(--accent-danger)' }}
                    >
                      5 / 9 VLMs &lt; 10 Exec
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white px-5 py-4">
                <img
                  src="./images/qa_execution_correlation.png"
                  alt="Figure 3: Correlation between Embodied Metric QA mean score and Metric-Constrained Execution mean score across 9 frontier VLMs."
                  width={1200}
                  height={640}
                  loading="lazy"
                  className="mx-auto max-h-[320px] w-full object-contain"
                />
              </div>

              <div className="space-y-4 border-t p-6" style={{ borderColor: 'var(--line-subtle)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {lang === 'en'
                    ? 'Across 10 matched layouts of Length Selection and Volume Selection, picking the candidate closest to GPT-6 Astra’s Metric QA estimates achieves 10/10 accuracy in both tasks—yet independent Execution succeeds only 2/10 and 3/10 times.'
                    : '在长度选择与体积选择的 10 组匹配布局中，直接依据 GPT-6 Astra 的 QA 测量结果做最近邻选择可 10/10 命中目标，但独立执行成功率仅分别为 2/10 与 3/10。'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <a
                    href={buildTrajectoryHref('gpt-6-astra', 'qa', 'length_select', 100)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white no-underline"
                    style={{ background: '#1a73e8' }}
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{lang === 'en' ? 'Inspect Length (QA 90 · Exec 0)' : '查看长度选择 (QA 90 · Exec 0)'}</span>
                  </a>
                  <a
                    href={buildTrajectoryHref('gpt-6-astra', 'qa', 'volume_select', 100)}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold no-underline"
                    style={{ borderColor: 'var(--line-strong)', color: 'var(--ink-primary)' }}
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{lang === 'en' ? 'Inspect Volume (QA 90 · Exec 0)' : '查看体积选择 (QA 90 · Exec 0)'}</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Measurement-Guided Execution Ablation */}
            <div className="paper-plate flex flex-col justify-between p-6 lg:col-span-5">
              <div className="space-y-2">
                <h3 className="text-base font-semibold">
                  <span className="font-mono-metric mr-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                    3.3
                  </span>
                  {lang === 'en'
                    ? 'Measurement-Guided Intervention'
                    : '显式测量与比较引导消融'}
                </h3>
                <p className="text-xs leading-relaxed sm:text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                  {lang === 'en'
                    ? 'Evaluated on 40 new matched layouts per task with GPT-6 Astra. Appending explicit measurement-and-comparison guidance—without changing model weights or tools—substantially raises execution accuracy while reducing wrong-object placements.'
                    : '在每任务 40 组全新匹配布局上，不修改模型参数与工具接口，仅追加显式测量与对比提示即可显著提升执行成功率并大幅降低错选率。'}
                </p>
              </div>

              <div className="my-6 space-y-5">
                {GUIDANCE_ABLATION.map((row) => (
                  <div
                    key={row.taskEn}
                    className="space-y-3 rounded-lg border p-4"
                    style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-page)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">
                        {lang === 'en' ? row.taskEn : row.taskZh}
                      </h4>
                      <span
                        className="font-mono-metric rounded px-2 py-0.5 text-xs font-semibold"
                        style={{ background: 'rgba(19, 115, 51, 0.12)', color: 'var(--accent-emerald)' }}
                      >
                        {row.deltaPp}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span style={{ color: 'var(--ink-muted)' }}>
                            {lang === 'en' ? 'Original Instruction' : '原始指令'}
                          </span>
                          <span className="font-mono-metric font-semibold">
                            {row.origCount} ({row.origPct.toFixed(1)}%)
                          </span>
                        </div>
                        <ScoreBar score={row.origPct} />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span>{lang === 'en' ? 'Measurement-Guided' : '显式测量引导'}</span>
                          <span
                            className="font-mono-metric font-semibold"
                            style={{ color: 'var(--accent-emerald)' }}
                          >
                            {row.guidedCount} ({row.guidedPct.toFixed(1)}%)
                          </span>
                        </div>
                        <ScoreBar score={row.guidedPct} />
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-between border-t pt-2.5 text-xs"
                      style={{ borderColor: 'var(--line-subtle)', color: 'var(--ink-muted)' }}
                    >
                      <span>{lang === 'en' ? 'Wrong-object placements' : '错选入区次数'}</span>
                      <span className="font-mono-metric font-semibold" style={{ color: 'var(--ink-primary)' }}>
                        {row.wrongOrig} → {row.wrongGuided}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="#/leaderboard"
                className="inline-flex items-center justify-between border-t pt-4 text-xs font-semibold no-underline"
                style={{ borderColor: 'var(--line-subtle)', color: 'var(--accent-primary)' }}
              >
                <span>{lang === 'en' ? 'Inspect full per-task leaderboard' : '查看完整逐任务评测榜单'}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* 04 · 20 Parameterized Tasks (Full-Width 5-Column Academic Plate) */}
        <section
          id="tasks"
          className="space-y-6 border-t pt-16"
          style={{ borderColor: 'var(--line-subtle)' }}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="font-mono-metric text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--accent-primary)' }}>
                04 — {lang === 'en' ? 'Task Suite' : '任务套件'}
              </div>
              <h2 className="font-editorial text-3xl font-semibold tracking-tight">
                {tr.sectionTasksTitle}
              </h2>
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter tasks by category">
              <button
                type="button"
                aria-pressed={selectedCategory === 'ALL'}
                onClick={() => setSelectedCategory('ALL')}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  borderColor: selectedCategory === 'ALL' ? 'var(--accent-primary)' : 'var(--line-subtle)',
                  background: selectedCategory === 'ALL' ? 'var(--accent-soft)' : 'var(--bg-surface)',
                  color: selectedCategory === 'ALL' ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                }}
              >
                {tr.allCategories} (20)
              </button>
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="font-mono-metric rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      borderColor: active ? 'var(--accent-primary)' : 'var(--line-subtle)',
                      background: active ? 'var(--accent-soft)' : 'var(--bg-surface)',
                      color: active ? 'var(--accent-primary)' : 'var(--ink-secondary)',
                    }}
                  >
                    {cat.id} ({cat.tasks.length})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleTasks.map((task) => (
              <a
                key={task.id}
                href={buildExplorerHref({ task: task.id })}
                className="paper-plate group flex flex-col overflow-hidden no-underline transition-colors hover:border-blue-500/50"
                style={{ color: 'var(--ink-primary)' }}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
                  <img
                    src={`./images/tasks/${task.id}.jpg`}
                    alt={lang === 'en' ? task.nameEn : task.nameZh}
                    width={640}
                    height={480}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="font-mono-metric absolute left-2 top-2 rounded bg-slate-950/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {task.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-between space-y-2 p-3.5">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold leading-snug">
                      {lang === 'en' ? task.nameEn : task.nameZh}
                    </h3>
                    <p
                      className="line-clamp-2 text-[11px] leading-relaxed"
                      style={{ color: 'var(--ink-secondary)' }}
                    >
                      <span className="font-mono-metric font-semibold" style={{ color: 'var(--ink-primary)' }}>
                        Exec:{' '}
                      </span>
                      {lang === 'en' ? task.execEn : task.execZh}
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 pt-1 text-[11px] font-semibold"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    <span>{tr.viewTrajs}</span>
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* 05 · Multi-Embodiment Framework & Cross-Platform Evaluation */}
        <section
          id="framework"
          className="space-y-8 border-t pt-16"
          style={{ borderColor: 'var(--line-subtle)' }}
        >
          <div className="space-y-2">
            <div className="font-mono-metric text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--accent-primary)' }}>
              05 — {lang === 'en' ? 'Simulation & Generalization' : '仿真框架与跨平台泛化'}
            </div>
            <h2 className="font-editorial text-3xl font-semibold tracking-tight">
              {tr.sectionFrameworkTitle}
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
              {tr.sectionFrameworkLead}
            </p>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-12">
            {/* Left: 6 Supported Robot Platforms */}
            <div className="paper-plate p-5 lg:col-span-7">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {lang === 'en' ? 'Six Supported Dual-Arm Robot Platforms' : '统一工具接口支持的 6 种机器人平台'}
                </span>
                <span className="font-mono-metric text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Isaac Sim 6.0.1 · Isaac Lab 3.0 · cuRobo
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                {ROBOT_PLATFORMS.map((robot) => (
                  <div
                    key={robot.id}
                    className="rounded-lg border p-2.5 text-center"
                    style={{ borderColor: 'var(--line-subtle)', background: 'var(--bg-page)' }}
                  >
                    <div className="overflow-hidden rounded bg-[#f4f5f6] p-1.5">
                      <img
                        src={robot.image}
                        alt={robot.name}
                        width={480}
                        height={480}
                        loading="lazy"
                        className="aspect-square w-full object-contain"
                      />
                    </div>
                    <div className="mt-2 text-xs font-semibold">{robot.name}</div>
                    <div className="font-mono-metric text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                      {robot.dof} · {robot.aperture}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Table 2 Cross-Platform Results */}
            <div className="space-y-3 lg:col-span-5">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">
                  <span className="font-mono-metric mr-2" style={{ color: 'var(--accent-primary)' }}>
                    {lang === 'en' ? 'Table 2.' : '表 2.'}
                  </span>
                  {lang === 'en'
                    ? 'Cross-Platform Execution (GPT-6 Astra)'
                    : '跨机器人平台执行结果（GPT-6 Astra）'}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                  {lang === 'en'
                    ? '20 tasks × 10 seeds (200 episodes per robot) without modifying prompts or Cartesian tool interfaces.'
                    : '在不改变提示词与末端工具接口的前提下，于三种机器人平台各评测 200 回合。'}
                </p>
              </div>

              <div tabIndex={0} role="region" aria-labelledby="home-cross-caption" className="table-wrapper rounded-lg border" style={{ borderColor: 'var(--line-subtle)' }}>
                <table className="metric-table booktabs-table" style={{ minInlineSize: '420px' }}>
                  <caption id="home-cross-caption" className="sr-only-status">
                    Cross-platform execution scores for GPT-6 Astra across UR5e, Franka Panda, and PiPER
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Platform</th>
                      <th scope="col">Mean</th>
                      <th scope="col">GAS</th>
                      <th scope="col">DDC</th>
                      <th scope="col">ARC</th>
                      <th scope="col">SPF</th>
                      <th scope="col">CGM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CROSS_PLATFORM_RESULTS.map((r) => (
                      <tr key={r.robot}>
                        <th scope="row" className="whitespace-nowrap">
                          {r.robot}
                        </th>
                        <td
                          className="font-mono-metric text-xs font-bold"
                          style={{ color: 'var(--accent-primary)' }}
                        >
                          {r.Mean.toFixed(2)}
                        </td>
                        <td className="font-mono-metric text-xs">{r.GAS.toFixed(1)}</td>
                        <td className="font-mono-metric text-xs">{r.DDC.toFixed(1)}</td>
                        <td className="font-mono-metric text-xs">{r.ARC.toFixed(1)}</td>
                        <td className="font-mono-metric text-xs">{r.SPF.toFixed(1)}</td>
                        <td className="font-mono-metric text-xs">{r.CGM.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {lang === 'en'
                  ? 'UR5e achieves the highest overall score (53.86) and leads GAS/CGM due to its larger reach and gripper aperture, while PiPER’s shorter kinematic reach limits performance on wide-workspace formations.'
                  : 'UR5e 凭借更宽工作空间与夹爪行程取得最高总分（53.86）并在 GAS/CGM 领先；PiPER 受限于较短臂展，在大范围空间队列任务上表现受限。'}
              </p>
            </div>
          </div>
        </section>

        {/* 06 · Academic Citation (BibTeX) */}
        <section
          id="bibtex"
          className="scroll-mt-24 space-y-4 border-t pt-16"
          style={{ borderColor: 'var(--line-subtle)' }}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="font-mono-metric text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--accent-primary)' }}>
                06 — {lang === 'en' ? 'Citation' : '论文引用'}
              </div>
              <h2 tabIndex={-1} className="font-editorial text-2xl font-semibold tracking-tight focus:outline-none">
                BibTeX
              </h2>
            </div>

            <button
              type="button"
              onClick={handleCopyBibtex}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                borderColor: 'var(--line-strong)',
                background: 'var(--bg-surface)',
                color: bibCopied ? 'var(--accent-emerald)' : 'var(--ink-primary)',
              }}
            >
              {bibCopied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{lang === 'en' ? 'Copied' : '已复制'}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{lang === 'en' ? 'Copy BibTeX' : '复制 BibTeX'}</span>
                </>
              )}
            </button>
          </div>

          <pre
            className="paper-plate font-mono-metric overflow-x-auto p-5 text-xs leading-relaxed"
            style={{ color: 'var(--ink-primary)' }}
          >
            <code>{BIBTEX_SNIPPET}</code>
          </pre>
        </section>
      </div>
    </div>
  );
}
