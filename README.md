# RoboMetriX-Page

Interactive project page, benchmark leaderboard, 3,600-trajectory explorer, playback studio, and side-by-side comparison studio for **RoboMetriX**.

## Local Development

```bash
pnpm install
pnpm dev
```

Build static assets into `dist/` (uses relative `base: './'` and hash routing, ready for GitHub Pages, Cloudflare Pages, or Hugging Face Static Spaces):

```bash
pnpm build
pnpm preview
```

## Full 3,600-Trajectory Media Archive

`public/data/index.json` ships with sanitized metadata, exact paper scores, errors, hard constraints, and instructions for **all 3,600 trajectories**, along with **16 bundled showcase trajectories** (full `video.mp4`, `timeline.json`, and 3-view observation frames) for immediate playback.

To export all 3,600 episodes into a clean web bundle for external hosting (e.g., **Hugging Face Datasets** or **Cloudflare R2**):

```bash
python3 scripts/export_web_bundle.py \
  --source-root /path/to/raw-experiments \
  --output-dir /path/to/web-bundle \
  --task-covers-dir /path/to/web-bundle/task-covers \
  --bundle-mode all
```

Then set `VITE_MEDIA_BASE_URL` in `.env.local` (or your CI build environment) to the hosted root URL (containing `episodes/<model>/<protocol>/<task>/seed-<N>/`) and rebuild:

```bash
VITE_MEDIA_BASE_URL="https://your-media-host.example/robometrix" pnpm build
```
