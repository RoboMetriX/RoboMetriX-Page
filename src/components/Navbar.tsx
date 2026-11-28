import { useId } from 'react';
import { Code2, Globe, Menu, Moon, Sun } from 'lucide-react';
import type { Lang, PageRoute, Theme } from '../types/benchmark';
import { t } from '../lib/i18n';

interface NavbarProps {
  route: PageRoute;
  lang: Lang;
  theme: Theme;
  totalEpisodes: number;
  onToggleLang: () => void;
  onToggleTheme: () => void;
}

export function Navbar({
  route,
  lang,
  theme,
  onToggleLang,
  onToggleTheme,
}: NavbarProps) {
  const tr = t(lang);
  const mobileMenuId = useId();

  const items = [
    { key: 'home' as const, href: '#/', label: tr.navHome },
    { key: 'leaderboard' as const, href: '#/leaderboard', label: tr.navLeaderboard },
    { key: 'explorer' as const, href: '#/explorer', label: tr.navExplorer },
  ];

  const activeSectionKey = route.page === 'trajectory' ? 'explorer' : route.page;

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-xl"
      style={{
        borderColor: 'var(--line-subtle)',
        backgroundColor: 'color-mix(in srgb, var(--bg-surface) 86%, transparent)',
      }}
    >
      <div className="mx-auto grid h-16 max-w-[1380px] grid-cols-[1fr_auto] items-center gap-4 px-5 sm:px-8 md:grid-cols-[1fr_auto_1fr] lg:px-10">
        {/* Left: Bespoke RoboMetriX Typographic Wordmark */}
        <div className="flex items-center">
          <a
            href="#/"
            aria-label="RoboMetriX Home"
            className="group relative inline-flex shrink-0 items-center py-1 no-underline"
          >
            <span className="relative inline-flex items-baseline leading-none">
              <span
                className="font-display text-[21px] font-bold tracking-[-0.045em]"
                style={{ color: 'var(--ink-primary)' }}
              >
                Robo
              </span>
              <span className="rmx-wordmark-metri font-display text-[21px] font-bold tracking-[-0.045em]">
                Metri
              </span>
              <span className="relative inline-flex items-baseline">
                <span className="rmx-wordmark-x font-display text-[22px] font-extrabold tracking-[-0.04em]">
                  X
                </span>
                {/* Subtle blueprint horizontal dimension arrow crowning MetriX & vertical tick by X */}
                <svg
                  width="64"
                  height="26"
                  viewBox="0 0 64 26"
                  fill="none"
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-2.5 -top-1.5 opacity-85 transition-opacity group-hover:opacity-100"
                >
                  {/* Top horizontal precision dimension line */}
                  <path
                    d="M4 3.5h50"
                    stroke="var(--accent-primary)"
                    strokeWidth="1.05"
                    strokeLinecap="round"
                    strokeOpacity="0.65"
                  />
                  <path
                    d="M6.8 1.5L4 3.5l2.8 2M51.2 1.5L54 3.5l-2.8 2"
                    stroke="var(--accent-primary)"
                    strokeWidth="1.05"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity="0.75"
                  />
                  {/* Right vertical height tick alongside X */}
                  <path
                    d="M59.5 7.5v15"
                    stroke="var(--accent-amber)"
                    strokeWidth="1.05"
                    strokeLinecap="round"
                    strokeOpacity="0.7"
                  />
                  <path
                    d="M57.8 7.5h3.4M57.8 22.5h3.4"
                    stroke="var(--accent-amber)"
                    strokeWidth="1.05"
                    strokeLinecap="round"
                    strokeOpacity="0.75"
                  />
                </svg>
              </span>
            </span>
          </a>
        </div>

        {/* Center: Clean Segmented Pill Navigation */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-0.5 rounded-full border p-1 md:inline-flex"
          style={{
            borderColor: 'var(--line-subtle)',
            backgroundColor: 'var(--bg-subtle)',
          }}
        >
          {items.map((item) => {
            const isExactPage = route.page === item.key;
            const isSection = activeSectionKey === item.key && !isExactPage;
            return (
              <a
                key={item.key}
                href={item.href}
                className="nav-pill"
                aria-current={isExactPage ? 'page' : undefined}
                data-section-active={isSection ? 'true' : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Right: Uniform Height Utility Controls */}
        <div className="flex items-center justify-end gap-2">
          <a
            href="https://github.com/RoboMetriX/RoboMetriX-Page"
            target="_blank"
            rel="noreferrer"
            className="hidden h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium no-underline transition-colors hover:bg-black/5 dark:hover:bg-white/5 sm:inline-flex"
            style={{
              borderColor: 'var(--line-subtle)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--ink-secondary)',
            }}
          >
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{tr.code}</span>
          </a>

          <button
            type="button"
            onClick={onToggleLang}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: 'var(--line-subtle)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--ink-secondary)',
            }}
            title={lang === 'en' ? 'Switch to Chinese' : '切换为英文'}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{lang === 'en' ? '中文' : 'EN'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: 'var(--line-subtle)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--ink-secondary)',
            }}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? (
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border md:hidden"
            style={{
              borderColor: 'var(--line-subtle)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--ink-primary)',
            }}
            aria-label="Open navigation menu"
            aria-controls={mobileMenuId}
            popoverTarget={mobileMenuId}
            popoverTargetAction="toggle"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          <div
            id={mobileMenuId}
            popover="auto"
            className="fixed right-4 top-18 m-0 w-56 rounded-2xl border p-2 shadow-xl md:hidden"
            style={{
              borderColor: 'var(--line-subtle)',
              background: 'var(--bg-surface)',
              color: 'var(--ink-primary)',
            }}
          >
            <nav aria-label="Mobile primary" className="flex flex-col gap-1">
              {items.map((item) => {
                const isExactPage = route.page === item.key;
                const isHighlighted = activeSectionKey === item.key;
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    className="rounded-xl px-3.5 py-2 text-sm font-medium no-underline"
                    style={{
                      background: isHighlighted ? 'var(--accent-soft)' : 'transparent',
                      color: isHighlighted ? 'var(--accent-primary)' : 'var(--ink-primary)',
                    }}
                    aria-current={isExactPage ? 'page' : undefined}
                    onClick={() => {
                      const el = document.getElementById(mobileMenuId) as (HTMLElement & { hidePopover?: () => void }) | null;
                      el?.hidePopover?.();
                    }}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
