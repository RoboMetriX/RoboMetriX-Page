import { useEffect, useState } from 'react';
import type { IndexPayload, Lang, PageRoute, Theme } from './types/benchmark';
import { fetchIndex } from './lib/dataClient';
import { parseHashRoute } from './lib/router';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ExplorerPage } from './pages/ExplorerPage';
import { TrajectoryStudioPage } from './pages/TrajectoryStudioPage';

export function App() {
  const [route, setRoute] = useState<PageRoute>(() => parseHashRoute(window.location.hash));
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('robometrix-lang');
    return saved === 'zh' ? 'zh' : 'en';
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('robometrix-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [index, setIndex] = useState<IndexPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = (event: HashChangeEvent) => {
      const next = parseHashRoute(window.location.hash);
      setRoute(next);
      if (next.page !== 'leaderboard' || parseHashRoute(new URL(event.oldURL, window.location.href).hash).page !== 'leaderboard') {
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('robometrix-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    localStorage.setItem('robometrix-lang', lang);
  }, [lang]);

  useEffect(() => {
    fetchIndex()
      .then((payload) => setIndex(payload))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar
        route={route}
        lang={lang}
        theme={theme}
        totalEpisodes={index?.total_episodes ?? 3600}
        onToggleLang={() => setLang((prev) => (prev === 'en' ? 'zh' : 'en'))}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
      />

      <main className="flex-1">
        {error ? (
          <div className="mx-auto max-w-xl px-4 py-24 text-center">
            <h1 className="font-serif-display text-2xl font-medium">Failed to load benchmark index</h1>
            <p className="font-mono-metric mt-2 text-xs" style={{ color: 'var(--accent-danger)' }}>
              {error}
            </p>
          </div>
        ) : !index ? (
          <div className="mx-auto flex max-w-[1440px] items-center justify-center px-4 py-32">
            <div className="font-mono-metric text-xs tracking-wider" style={{ color: 'var(--ink-muted)' }}>
              LOADING ROBOMETRIX INDEX (3,600 TRAJECTORIES)...
            </div>
          </div>
        ) : route.page === 'home' ? (
          <HomePage index={index} lang={lang} />
        ) : route.page === 'leaderboard' ? (
          <LeaderboardPage index={index} lang={lang} tab={route.tab} />
        ) : route.page === 'explorer' ? (
          <ExplorerPage index={index} lang={lang} query={route.query} />
        ) : (
          <TrajectoryStudioPage
            index={index}
            lang={lang}
            modelId={route.modelId}
            protocol={route.protocol}
            taskId={route.taskId}
            seed={route.seed}
            initialRound={route.round}
          />
        )}
      </main>

      <footer
        className="border-t py-8 text-xs"
        style={{ borderColor: 'var(--line-subtle)', color: 'var(--ink-muted)' }}
      >
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-3 px-5 sm:px-8 lg:px-10">
          <div className="font-mono-metric">
            RoboMetriX · Metric-Constrained Manipulation Benchmark · Isaac Sim 6.0.1 / Isaac Lab 3.0 / cuRobo
          </div>
          <div className="flex items-center gap-5">
            <a href="#/" className="no-underline hover:underline" style={{ color: 'var(--ink-secondary)' }}>
              Overview
            </a>
            <a href="#/leaderboard" className="no-underline hover:underline" style={{ color: 'var(--ink-secondary)' }}>
              Leaderboard
            </a>
            <a href="#/explorer" className="no-underline hover:underline" style={{ color: 'var(--ink-secondary)' }}>
              Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
