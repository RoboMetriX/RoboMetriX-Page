#!/usr/bin/env python3
"""Export privacy-sanitized RoboMetriX web archive (index.json + episode bundles).

Reads raw experiment archives containing `<model-dir>/episodes/<task>/seed-*/{result.json,timeline.jsonl,video.mp4,media/}`
and outputs a clean static bundle suitable for web hosting (GitHub Pages / Cloudflare R2 / Hugging Face Datasets).

Privacy guarantees:
- Never copies `requests/` or `responses/` (which may contain private base URLs or headers).
- Strips server paths, API cost/pricing details, and internal timestamps.
- Only retains benchmark-relevant observations, reasoning text, tool calls, metrics, and media.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from statistics import fmean
from typing import Any

from PIL import Image

MODELS: list[dict[str, str]] = [
    {"id": "gpt-6-astra", "label": "GPT-6 Astra", "short": "Astra", "family": "GPT", "effort": "medium", "dir_prefix": "gpt-6-astra-medium"},
    {"id": "gpt-6.1-sol", "label": "GPT-6.1 Sol", "short": "Sol", "family": "GPT", "effort": "medium", "dir_prefix": "gpt-6.1-sol-medium"},
    {"id": "gpt-6.1-terra", "label": "GPT-6.1 Terra", "short": "Terra", "family": "GPT", "effort": "medium", "dir_prefix": "gpt-6.1-terra-medium"},
    {"id": "gpt-6-luna", "label": "GPT-6 Luna", "short": "Luna", "family": "GPT", "effort": "medium", "dir_prefix": "gpt-6-luna-medium"},
    {"id": "claude-opus-5-5", "label": "Claude Opus 5.5", "short": "Opus", "family": "Claude", "effort": "medium", "dir_prefix": "claude-opus-5-5-medium"},
    {"id": "deepseek-flash", "label": "DeepSeek V4.1 Flash", "short": "DeepSeek", "family": "DeepSeek", "effort": "high", "dir_prefix": "deepseek-flash-high"},
    {"id": "qwen3.8-max", "label": "Qwen 3.8 Max", "short": "Qwen", "family": "Qwen", "effort": "medium", "dir_prefix": "qwen3.8-max-medium"},
    {"id": "kimi-k3.1-pro", "label": "Kimi K3.1 Pro", "short": "Kimi", "family": "Kimi", "effort": "high", "dir_prefix": "kimi-k3.1-pro-high"},
    {"id": "gemini-4-hydrogen", "label": "Gemini 4 Hydrogen", "short": "Hydrogen", "family": "Gemini", "effort": "medium", "dir_prefix": "gemini-4-hydrogen-medium"},
]

TOLERANCES = {"cm": 1.0, "deg": 1.0, "cm2": 2.0, "cm3": 5.0}

CATEGORY_TASKS: dict[str, tuple[str, ...]] = {
    "GAS": ("length_select", "metric_select", "area_select", "volume_select"),
    "DDC": (
        "slide_block", "pull_drawer", "push_object", "metric_overhang_push",
        "surface_gap_placement", "metric_gap_placement",
    ),
    "ARC": ("rotate_pointer", "rod_angle", "open_laptop"),
    "SPF": (
        "position_placement", "two_anchor_placement", "equal_spacing",
        "rectangle_formation", "circular_placement",
    ),
    "CGM": ("arc_slide_block", "stack_to_height"),
}

TASK_TO_CATEGORY = {task: cat for cat, tasks in CATEGORY_TASKS.items() for task in tasks}


def _numbered(pattern: str, count: int) -> tuple[str, ...]:
    return tuple(pattern.format(i=i) for i in range(1, count + 1))


EXECUTION_FIELDS: dict[str, tuple[str, ...]] = {
    "arc_slide_block": ("position_error_cm",),
    "area_select": (),
    "circular_placement": tuple(f"target_{i}_position_error_cm" for i in range(3)),
    "equal_spacing": (
        *(f"target_error_{i}_cm" for i in range(4)),
        *(f"spacing_error_{i}_cm" for i in range(3)),
    ),
    "length_select": (),
    "metric_gap_placement": ("left_gap_error_cm", "right_gap_error_cm", "left_lateral_error_cm", "right_lateral_error_cm"),
    "metric_overhang_push": ("absolute_error_cm",),
    "metric_select": (),
    "open_laptop": ("angle_error_deg",),
    "position_placement": ("radius_error_cm", "angle_error_deg"),
    "pull_drawer": ("position_error_cm",),
    "push_object": ("position_error_cm",),
    "rectangle_formation": tuple(f"bottle_{i}_position_error_cm" for i in range(1, 5)),
    "rod_angle": ("angle_error_deg",),
    "rotate_pointer": ("angle_error_deg",),
    "slide_block": ("position_error_cm",),
    "stack_to_height": ("height_error_cm",),
    "surface_gap_placement": ("gap_error_cm", "rubik_cube_a_lateral_error_cm", "rubik_cube_b_lateral_error_cm"),
    "two_anchor_placement": ("red_error_cm", "blue_error_cm"),
    "volume_select": (),
}

QA_FIELDS: dict[str, tuple[str, ...]] = {
    "arc_slide_block": ("center_error_cm", "radius_error_cm"),
    "area_select": _numbered("item_{i}_absolute_error_cm2", 10),
    "circular_placement": ("center_position_error_cm",),
    "equal_spacing": ("start_error_cm",),
    "length_select": _numbered("lane_{i}_absolute_error_cm", 5),
    "metric_gap_placement": ("reference_error_cm",),
    "metric_overhang_push": ("absolute_error_cm",),
    "metric_select": _numbered("cup_{i}_height_error_cm", 5),
    "open_laptop": ("hinge_y_error_cm", "initial_angle_error_deg"),
    "position_placement": ("origin_position_error_cm",),
    "pull_drawer": ("direction_error_deg",),
    "push_object": ("position_error_cm",),
    "rectangle_formation": ("position_error_cm",),
    "rod_angle": ("angle_error_deg",),
    "rotate_pointer": ("position_error_cm",),
    "slide_block": ("q1_error_deg", "q2_error_cm"),
    "stack_to_height": _numbered("block_{i}_height_error_cm", 6),
    "surface_gap_placement": ("cube_1_edge_absolute_error_cm", "cube_2_edge_absolute_error_cm", "line_y_env_absolute_error_cm"),
    "two_anchor_placement": ("red_error_cm", "blue_error_cm"),
    "volume_select": _numbered("item_{i}_absolute_error_cm3", 5),
}

CURATED_EPISODE_IDS: list[str] = [
    # Measurement strategies + paired QA/Execution showcases
    "gpt-6-astra__execution__stack_to_height__seed-101",
    "gpt-6-astra__qa__stack_to_height__seed-101",
    "gpt-6-astra__execution__length_select__seed-100",
    "gpt-6-astra__qa__length_select__seed-100",
    "gpt-6-astra__execution__volume_select__seed-100",
    "gpt-6-astra__qa__volume_select__seed-100",
    "gpt-6-astra__execution__rod_angle__seed-100",
    "gpt-6-astra__qa__rod_angle__seed-100",
    "gpt-6-astra__execution__open_laptop__seed-100",
    "gpt-6-astra__qa__open_laptop__seed-100",
    "gpt-6-astra__execution__arc_slide_block__seed-100",
    "gpt-6-astra__qa__arc_slide_block__seed-100",
    # 3-model comparison on circular_placement seed-102 + Astra QA
    "gpt-6-astra__execution__circular_placement__seed-102",
    "gpt-6.1-sol__execution__circular_placement__seed-102",
    "claude-opus-5-5__execution__circular_placement__seed-102",
    "gpt-6-astra__qa__circular_placement__seed-102",
]

CURATED_TAGS: dict[str, list[str]] = {
    "gpt-6-astra__qa__volume_select__seed-100": ["image-change", "curated", "paired-gap"],
    "gpt-6-astra__execution__volume_select__seed-100": ["curated", "paired-gap", "wrong-object"],
    "gpt-6-astra__qa__length_select__seed-100": ["image-change", "curated", "paired-gap"],
    "gpt-6-astra__execution__length_select__seed-100": ["curated", "paired-gap", "wrong-object"],
    "gpt-6-astra__qa__rod_angle__seed-100": ["visual-alignment", "curated"],
    "gpt-6-astra__execution__rod_angle__seed-100": ["visual-alignment", "curated"],
    "gpt-6-astra__qa__arc_slide_block__seed-100": ["visual-alignment", "curated"],
    "gpt-6-astra__execution__arc_slide_block__seed-100": ["curated"],
    "gpt-6-astra__qa__open_laptop__seed-100": ["interactive-reference", "curated"],
    "gpt-6-astra__execution__open_laptop__seed-100": ["interactive-reference", "curated"],
    "gpt-6-astra__qa__stack_to_height__seed-101": ["interactive-reference", "curated"],
    "gpt-6-astra__execution__stack_to_height__seed-101": ["curated", "sub-mm-precision"],
    "gpt-6-astra__execution__circular_placement__seed-102": ["curated", "cross-model", "sub-mm-precision"],
    "gpt-6.1-sol__execution__circular_placement__seed-102": ["curated", "cross-model"],
    "claude-opus-5-5__execution__circular_placement__seed-102": ["curated", "cross-model", "early-give-up"],
    "gpt-6-astra__qa__circular_placement__seed-102": ["curated", "cross-model"],
}

TCP_LABEL_RE = re.compile(r"(?:left|right)_(?:x|y|z|pitch_deg|roll_deg|yaw_deg|gripper)")
TCP_LINE_RE = re.compile(rf"({TCP_LABEL_RE.pattern})=([-+]?\d+(?:\.\d+)?)")
URL_RE = re.compile(r"""(?i)\b(?:https?|wss?|ftp|file)://[^\s"'<>]+""")
QUOTED_PATH_RE = re.compile(r"""(["'])(?:[A-Za-z]:[\\/]|\\\\|~/|/)[^"'\r\n]+\1""")
ABSOLUTE_PATH_RE = re.compile(r"""(?<![\w./\\])(?:[A-Za-z]:[\\/]|\\\\|~/|/)[^\s"'<>|,;()[\]{}]+""")
SECRET_FIELD_RE = re.compile(
    r"""(?ix)(\b(?:api[-_ ]?key|(?:access|refresh|auth|private|secret)[-_ ]?token|client[-_ ]?secret"""
    r"""|password|authorization|token)\b["']?\s*[:=]\s*)(?:bearer\s+)?(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}\]]+)"""
)
TOKEN_RE = re.compile(
    r"(?ix)\b(?:bearer\s+[a-z0-9._~+/-]+=*|(?:sk-|gh[pousr]_|github_pat_|hf_|xox[baprs]-|AIza)[a-z0-9_-]{12,}"
    r"|(?:AKIA|ASIA)[A-Z0-9]{16}|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)"
)


def _unit(field: str) -> str:
    return field.rsplit("_", 1)[1]


def _err_val(metrics: dict[str, Any], field: str) -> float | None:
    value = metrics.get(field)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        number = float(value)
    except OverflowError:
        return None
    return abs(number) if math.isfinite(number) else None


def compute_episode_score(result: dict[str, Any], task: str, raw_mode: str) -> dict[str, Any]:
    evaluation = result.get("evaluation") or {}
    metrics = evaluation.get("metrics") or {}
    fields = QA_FIELDS[task] if raw_mode == "qa" else EXECUTION_FIELDS[task]
    constraints = evaluation.get("hard_constraints") if raw_mode == "original" else {}
    constraints = constraints or {}
    constraints_passed = all(
        bool(passed)
        for indicators in constraints.values()
        if isinstance(indicators, dict)
        for passed in indicators.values()
    )
    errors = {field: _err_val(metrics, field) for field in fields}
    success = bool(result.get("success", False))

    if fields:
        component_scores = {
            field: 100.0 * max(0.0, 1.0 - val / TOLERANCES[_unit(field)]) if val is not None else 0.0
            for field, val in errors.items()
        }
        vals = list(component_scores.values())
        score = fmean(vals) if raw_mode == "qa" else min(vals)
    else:
        component_scores = {}
        score = 100.0 if success else 0.0

    if not constraints_passed:
        score = 0.0

    return {
        "score": score,
        "success": success,
        "scored_success": bool(success and constraints_passed),
        "hard_constraints_passed": constraints_passed,
        "hard_constraints": constraints,
        "errors": {k: (round(v, 4) if v is not None else None) for k, v in errors.items()},
        "component_scores": component_scores,
    }


def _parse_tcp_state(prompt_text: str) -> dict[str, float]:
    state: dict[str, float] = {}
    for line in prompt_text.splitlines():
        m = TCP_LINE_RE.fullmatch(line.strip())
        if m:
            value = float(m.group(2))
            if math.isfinite(value):
                state[m.group(1)] = value
    return state


def _sanitize_text(text: str | None) -> str | None:
    if not isinstance(text, str):
        return None
    text = SECRET_FIELD_RE.sub(r"\1[redacted]", text)
    text = TOKEN_RE.sub("[redacted]", text)
    text = URL_RE.sub("[redacted URL]", text)
    text = QUOTED_PATH_RE.sub("[redacted path]", text)
    return ABSOLUTE_PATH_RE.sub("[redacted path]", text).replace("RoboMetricX", "RoboMetriX")


def _sanitize_json(value: Any) -> Any:
    if isinstance(value, str):
        return _sanitize_text(value)
    if isinstance(value, list):
        return [_sanitize_json(item) for item in value]
    if isinstance(value, dict):
        return {_sanitize_text(key): _sanitize_json(item) for key, item in value.items()}
    return value


def _media_source(ep_dir: Path, relative_path: str) -> Path | None:
    media_root = ep_dir.resolve() / "media"
    resolved = (ep_dir / relative_path).resolve()
    if resolved.is_relative_to(media_root) and resolved.is_file():
        return resolved
    return None


def _target_delta(label: str, target: float, observed: float) -> float:
    delta = target - observed
    if label.endswith(("_yaw_deg", "_pitch_deg")):
        delta %= 360
        if delta > 180:
            delta -= 360
        delta = round(delta, 4)
        return 180.0 if delta == -180 else delta
    return round(delta, 4)


def parse_timeline_summary_and_rounds(
    ep_dir: Path,
    export_media_dir: Path | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Parse timeline.jsonl into summary stats + clean deduplicated rounds."""
    tl_path = ep_dir / "timeline.jsonl"
    summary: dict[str, Any] = {
        "instruction": "",
        "control_dt_s": 1.0 / 30.0,
        "robot": "franka_panda",
        "rounds_count": 0,
        "planning_failures": 0,
        "tool_errors": 0,
        "video_duration_s": None,
        "has_give_up": False,
        "system_prompt": "",
        "tools": [],
    }

    rounds: list[dict[str, Any]] = []
    req_to_round: dict[int, dict[str, Any]] = {}
    current_round: dict[str, Any] | None = None
    if not tl_path.is_file():
        if export_media_dir is not None:
            raise FileNotFoundError(f"Missing timeline for requested episode bundle: {tl_path}")
        return summary, rounds

    if export_media_dir is not None:
        export_media_dir.mkdir(parents=True, exist_ok=True)

    def _copy_frame(rel_src: str, dest_name: str) -> str | None:
        if export_media_dir is None or Path(dest_name).name != dest_name or "\\" in dest_name:
            return None
        src = _media_source(ep_dir, rel_src)
        if src is None:
            return None
        dest = export_media_dir / dest_name
        if not dest.exists():
            if src.suffix.lower() in (".jpg", ".jpeg"):
                shutil.copy2(src, dest)
            else:
                with Image.open(src) as img:
                    img.convert("RGB").save(dest, format="JPEG", quality=82, optimize=True)
        return f"frames/{dest_name}"

    with tl_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            ev = json.loads(line)
            kind = ev.get("kind")

            if kind == "episode_start":
                summary["instruction"] = _sanitize_text(ev.get("instruction", "")) or ""
                summary["control_dt_s"] = float(ev.get("control_dt_s") or (1.0 / 30.0))
                summary["robot"] = _sanitize_text(ev.get("robot_name")) or "franka_panda"

            elif kind == "video_ready":
                dur = ev.get("duration_s")
                if isinstance(dur, (int, float)):
                    summary["video_duration_s"] = round(float(dur), 2)

            elif kind == "http_request":
                if not summary["system_prompt"]:
                    ctx = ev.get("context") or []
                    sys_parts = [c.get("text", "") for c in ctx if c.get("role") == "system"]
                    summary["system_prompt"] = _sanitize_text("\n\n".join(sys_parts)) or ""
                if not summary["tools"] and ev.get("tools"):
                    summary["tools"] = [
                        {"name": _sanitize_text(t.get("name")) or "", "description": _sanitize_text(t.get("description")) or ""}
                        for t in ev.get("tools", [])
                    ]

                if current_round is None or current_round["_responded"]:
                    rnum = len(rounds) + 1
                    prompt_text = _sanitize_text(ev.get("prompt", "")) or ""
                    tcp_state = _parse_tcp_state(prompt_text)
                    obs_images = []
                    for im in ev.get("images") or []:
                        cam = _sanitize_text(im.get("camera")) or "cam"
                        copied = _copy_frame(im.get("path", ""), f"r{rnum:02d}-obs-{cam}.jpg")
                        if copied:
                            obs_images.append({"camera": cam, "path": copied})
                    current_round = {
                        "round": rnum,
                        "time_s": round(float(ev.get("time_s", 0.0)), 2),
                        "start_step": int(ev.get("control_step", 0)),
                        "end_step": int(ev.get("control_step", 0)),
                        "executed_steps": 0,
                        "images": obs_images,
                        "after_images": [],
                        "tcp_state": tcp_state,
                        "reasoning": None,
                        "reasoning_kind": None,
                        "message": None,
                        "tool_calls": [],
                        "planning": [],
                        "tool_feedback": [],
                        "status": "pending",
                        "has_error": False,
                        "state_prompt": prompt_text,
                        "_responded": False,
                        "_last_step_imgs": [],
                    }
                    rounds.append(current_round)
                req_id = ev.get("request_id")
                if req_id is not None:
                    req_to_round[req_id] = current_round

            elif kind == "http_response":
                rnd = req_to_round.get(ev.get("request_id")) or current_round
                if rnd is None:
                    continue
                rnd["_responded"] = True
                rnd["status"] = "responded"
                reasoning_chunks: list[str] = []
                msg_chunks: list[str] = []
                for blk in ev.get("output") or []:
                    bkind = blk.get("kind")
                    if bkind in ("reasoning_text", "reasoning_summary"):
                        if blk.get("text"):
                            reasoning_chunks.append(blk["text"])
                            rnd["reasoning_kind"] = bkind
                    elif bkind == "message":
                        if blk.get("text"):
                            msg_chunks.append(blk["text"])
                    elif bkind == "tool_call":
                        tname = _sanitize_text(blk.get("name")) or ""
                        if tname == "give_up":
                            summary["has_give_up"] = True
                        raw_args = blk.get("arguments") or "{}"
                        try:
                            parsed = json.loads(raw_args)
                            if not isinstance(parsed, dict):
                                parsed = {}
                        except Exception:
                            parsed = {}
                        raw_targets = parsed.get("targets")
                        targets = None
                        if isinstance(raw_targets, dict):
                            targets = {
                                k: v for k, v in raw_targets.items()
                                if TCP_LABEL_RE.fullmatch(k) and _err_val(raw_targets, k) is not None
                            } or None
                        deltas = {
                            k: _target_delta(k, v, rnd["tcp_state"][k])
                            for k, v in (targets or {}).items() if k in rnd["tcp_state"]
                        } or None
                        tc_entry: dict[str, Any] = {
                            "name": tname,
                            "note": _sanitize_text(parsed.get("note")),
                            "reason": _sanitize_text(parsed.get("reason")),
                            "targets": targets,
                            "delta_targets": deltas,
                            "answers": _sanitize_json(parsed["answers"]) if isinstance(parsed.get("answers"), dict) else None,
                        }
                        rnd["tool_calls"].append(tc_entry)
                        if tname in ("answer", "done", "give_up"):
                            rnd["status"] = tname
                            if tname == "give_up":
                                rnd["has_error"] = True
                if reasoning_chunks:
                    rnd["reasoning"] = _sanitize_text("\n\n".join(reasoning_chunks))
                if msg_chunks:
                    rnd["message"] = _sanitize_text("\n\n".join(msg_chunks))
                if ev.get("status") in ("incomplete", "failed", "cancelled"):
                    rnd["has_error"] = True
                    rnd["status"] = ev.get("status")

            elif kind in ("http_failure", "http_cancelled"):
                rnd = req_to_round.get(ev.get("request_id")) or current_round
                if rnd is not None:
                    rnd["has_error"] = True
                    rnd["tool_feedback"].append({"status": "error", "message": kind})

            elif kind == "tool_result":
                rnd = req_to_round.get(ev.get("request_id")) or current_round
                if rnd is not None:
                    st = ev.get("status", "")
                    rnd["tool_feedback"].append({"status": _sanitize_text(st) or "", "message": _sanitize_text(ev.get("message")) or ""})
                    if st in ("invalid", "rejected"):
                        if not any(tc["name"] == "give_up" for tc in rnd["tool_calls"]):
                            rnd["has_error"] = True
                            summary["tool_errors"] += 1

            elif kind == "planning_result":
                rnd = req_to_round.get(ev.get("request_id")) or current_round
                if rnd is not None:
                    st = ev.get("status", "")
                    rnd["planning"].append({"arm": _sanitize_text(ev.get("arm")) or "", "status": _sanitize_text(st) or ""})
                    if st != "Success":
                        rnd["has_error"] = True
                        summary["planning_failures"] += 1

            elif kind == "step":
                rnd = req_to_round.get(ev.get("request_id")) or current_round
                if rnd is not None:
                    cstep = int(ev.get("control_step", rnd["end_step"]))
                    if rnd["executed_steps"] == 0:
                        rnd["start_step"] = cstep
                    rnd["executed_steps"] += 1
                    rnd["end_step"] = cstep
                    rnd["status"] = "executed"
                    if ev.get("images"):
                        rnd["_last_step_imgs"] = ev["images"]

    # Copy final step images per round if exporting media
    for rnd in rounds:
        if export_media_dir is not None and rnd["_last_step_imgs"]:
            after = []
            for im in rnd["_last_step_imgs"]:
                cam = _sanitize_text(im.get("camera")) or "cam"
                copied = _copy_frame(im.get("path", ""), f"r{rnd['round']:02d}-after-{cam}.jpg")
                if copied:
                    after.append({"camera": cam, "path": copied})
            rnd["after_images"] = after
        del rnd["_responded"]
        del rnd["_last_step_imgs"]

    summary["rounds_count"] = len(rounds)
    return summary, rounds


def _probe_video_dimensions(video_path: Path) -> tuple[int, int] | None:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return None
    try:
        res = subprocess.run(
            [
                ffprobe, "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x",
                str(video_path),
            ],
            capture_output=True, text=True, check=True,
        )
        parts = res.stdout.strip().splitlines()[0].split("x")
        if len(parts) == 2:
            return int(parts[0]), int(parts[1])
    except (subprocess.CalledProcessError, ValueError, IndexError, OSError):
        return None
    return None


def make_task_cover(ep_dir: Path, dest_path: Path) -> bool:
    if dest_path.exists():
        return True
    for candidate in ("media/step-000000-cam_head.png", "media/message-0002-part-02.jpg"):
        src = _media_source(ep_dir, candidate)
        if src is not None:
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(src) as img:
                img.convert("RGB").save(dest_path, format="JPEG", quality=82, optimize=True)
            return True
    return False


def export_bundle(
    source_root: Path,
    output_dir: Path,
    task_covers_dir: Path | None,
    bundle_mode: str,
    strip_header: bool = True,
) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)

    curated_set = set(CURATED_EPISODE_IDS)
    episodes_index: list[dict[str, Any]] = []
    # For verification against paper tables
    cat_check: dict[tuple[str, str], dict[str, list[float]]] = {}

    for model in MODELS:
        for raw_mode, proto in (("original", "execution"), ("qa", "qa")):
            model_dir = source_root / f"{model['dir_prefix']}-{raw_mode}"
            ep_root = model_dir / "episodes"
            if not ep_root.exists():
                print(f"ERROR: missing {ep_root}", file=sys.stderr)
                return 1
            for task_id, category in sorted(TASK_TO_CATEGORY.items()):
                for seed in range(100, 110):
                    ep_dir = ep_root / task_id / f"seed-{seed}"
                    res_path = ep_dir / "result.json"
                    if not res_path.exists():
                        print(f"ERROR: missing {res_path}", file=sys.stderr)
                        return 1
                    result = json.loads(res_path.read_text(encoding="utf-8"))
                    scored = compute_episode_score(result, task_id, raw_mode)
                    ep_id = f"{model['id']}__{proto}__{task_id}__seed-{seed}"
                    video_source = (ep_dir / "video.mp4").resolve()
                    has_video = video_source.is_relative_to(ep_dir.resolve()) and video_source.is_file()

                    should_bundle = (
                        bundle_mode == "all"
                        or (bundle_mode == "curated" and ep_id in curated_set)
                    )

                    if task_covers_dir is not None and model["id"] == "gpt-6-astra" and raw_mode == "original" and seed == 100:
                        make_task_cover(ep_dir, task_covers_dir / f"{task_id}.jpg")

                    bundle_dir = output_dir / "episodes" / model["id"] / proto / task_id / f"seed-{seed}"
                    media_dir = (bundle_dir / "frames") if should_bundle else None
                    tl_summary, rounds = parse_timeline_summary_and_rounds(ep_dir, export_media_dir=media_dir)

                    usage = result.get("usage") or {}
                    term = result.get("termination") or {}
                    term_reason = _sanitize_text(term.get("reason")) or _sanitize_text(result.get("status")) or "completed"
                    if tl_summary["has_give_up"]:
                        term_reason = "give_up"

                    tags = list(CURATED_TAGS.get(ep_id, []))
                    if not scored["hard_constraints_passed"] and proto == "execution":
                        tags.append("hard-constraint-fail")
                    if tl_summary["has_give_up"]:
                        tags.append("give-up")
                    if tl_summary["planning_failures"] > 0:
                        tags.append("planning-rejected")
                    if scored["score"] >= 90.0:
                        tags.append("high-score")

                    # Sanitize metrics (numeric/string/bool only)
                    raw_metrics = (result.get("evaluation") or {}).get("metrics") or {}
                    clean_metrics = {
                        _sanitize_text(k): (round(v, 4) if isinstance(v, float) else _sanitize_json(v))
                        for k, v in raw_metrics.items()
                        if isinstance(v, (int, float, str, bool)) or v is None
                    }
                    failure_reason = _sanitize_text((result.get("evaluation") or {}).get("failure_reason"))

                    entry = {
                        "id": ep_id,
                        "model_id": model["id"],
                        "model_label": model["label"],
                        "model_short": model["short"],
                        "family": model["family"],
                        "reasoning_effort": model["effort"],
                        "protocol": proto,
                        "category": category,
                        "task_id": task_id,
                        "seed": seed,
                        "score": scored["score"],
                        "success": scored["success"],
                        "scored_success": scored["scored_success"],
                        "hard_constraints_passed": scored["hard_constraints_passed"],
                        "rounds": tl_summary["rounds_count"],
                        "steps": int(result.get("steps", 0)),
                        "total_tokens": int(usage.get("total_tokens", 0) or 0),
                        "reasoning_tokens": int(usage.get("reasoning_tokens", 0) or 0),
                        "wall_time_s": round(float(result.get("wall_time_s") or 0.0), 1),
                        "termination_reason": term_reason,
                        "planning_failures": tl_summary["planning_failures"],
                        "tool_errors": tl_summary["tool_errors"],
                        "has_video": has_video,
                        "video_duration_s": tl_summary["video_duration_s"],
                        "bundled": should_bundle,
                        "tags": sorted(set(tags)),
                        "errors": scored["errors"],
                        "component_scores": scored["component_scores"],
                        "hard_constraints": scored["hard_constraints"],
                        "failure_reason": failure_reason,
                        "instruction": tl_summary["instruction"],
                    }
                    episodes_index.append(entry)

                    key = (model["id"], proto)
                    cat_check.setdefault(key, {}).setdefault(task_id, []).append(scored["score"])

                    if should_bundle:
                        bundle_dir.mkdir(parents=True, exist_ok=True)
                        ffmpeg = shutil.which("ffmpeg")
                        dst_vid = bundle_dir / "video.mp4"
                        video_ok = False
                        if has_video:
                            if strip_header:
                                if not ffmpeg or not shutil.which("ffprobe"):
                                    raise RuntimeError(
                                        "ffmpeg and ffprobe are required to strip legacy video headers; install both or pass --no-strip-header"
                                    )
                                dims = _probe_video_dimensions(video_source)
                                if dims is None:
                                    print(f"WARNING: unreadable video dimensions for {ep_id}; marking video unavailable", file=sys.stderr)
                                else:
                                    try:
                                        if dims == (1280, 720):
                                            subprocess.run(
                                                [
                                                    ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                                                    "-i", str(video_source),
                                                    "-vf", "crop=iw:ih-48:0:48",
                                                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                                                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
                                                    str(dst_vid),
                                                ],
                                                check=True,
                                            )
                                            video_ok = dst_vid.is_file()
                                        else:
                                            shutil.copy2(video_source, dst_vid)
                                            video_ok = dst_vid.is_file()
                                    except (subprocess.CalledProcessError, OSError) as err:
                                        print(f"WARNING: failed to process video for {ep_id}: {err}", file=sys.stderr)
                                        dst_vid.unlink(missing_ok=True)
                            else:
                                shutil.copy2(video_source, dst_vid)
                                video_ok = dst_vid.is_file()
                        poster_path = bundle_dir / "poster.jpg"
                        has_poster = False
                        if video_ok and ffmpeg and dst_vid.is_file():
                            try:
                                subprocess.run(
                                    [
                                        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                                        "-i", str(dst_vid),
                                        "-frames:v", "1", "-q:v", "3",
                                        str(poster_path),
                                    ],
                                    check=True,
                                )
                                has_poster = poster_path.is_file()
                            except (subprocess.CalledProcessError, OSError) as err:
                                print(f"WARNING: failed to extract poster for {ep_id}: {err}", file=sys.stderr)
                                poster_path.unlink(missing_ok=True)
                        if not has_poster:
                            has_poster = make_task_cover(ep_dir, poster_path)
                        if not video_ok:
                            entry["has_video"] = False
                        timeline_doc = {
                            "id": ep_id,
                            "model_id": model["id"],
                            "model_label": model["label"],
                            "reasoning_effort": model["effort"],
                            "protocol": proto,
                            "category": category,
                            "task_id": task_id,
                            "seed": seed,
                            "robot": tl_summary["robot"],
                            "instruction": tl_summary["instruction"],
                            "control_dt_s": tl_summary["control_dt_s"],
                            "score": scored["score"],
                            "success": scored["success"],
                            "scored_success": scored["scored_success"],
                            "hard_constraints_passed": scored["hard_constraints_passed"],
                            "hard_constraints": scored["hard_constraints"],
                            "metrics": clean_metrics,
                            "errors": scored["errors"],
                            "component_scores": scored["component_scores"],
                            "failure_reason": failure_reason,
                            "termination_reason": term_reason,
                            "steps": int(result.get("steps", 0)),
                            "verification_steps": int(result.get("verification_steps", 0)),
                            "wall_time_s": round(float(result.get("wall_time_s") or 0.0), 1),
                            "tokens": {
                                "input": int(usage.get("input_tokens", 0) or 0),
                                "cached_input": int(usage.get("cached_input_tokens", 0) or 0),
                                "output": int(usage.get("output_tokens", 0) or 0),
                                "reasoning": int(usage.get("reasoning_tokens", 0) or 0),
                                "total": int(usage.get("total_tokens", 0) or 0),
                            },
                            "video": "video.mp4" if video_ok else None,
                            "poster": "poster.jpg" if has_poster else None,
                            "video_duration_s": tl_summary["video_duration_s"],
                            "system_prompt": tl_summary["system_prompt"],
                            "tools": tl_summary["tools"],
                            "rounds": rounds,
                        }
                        (bundle_dir / "timeline.json").write_text(
                            json.dumps(timeline_doc, allow_nan=False, ensure_ascii=False, separators=(",", ":")),
                            encoding="utf-8",
                        )

    index_payload = {
        "schema_version": 1,
        "total_episodes": len(episodes_index),
        "bundled_episodes": sum(1 for e in episodes_index if e["bundled"]),
        "models": [{k: v for k, v in m.items() if k != "dir_prefix"} for m in MODELS],
        "categories": CATEGORY_TASKS,
        "tolerances": TOLERANCES,
        "episodes": episodes_index,
    }
    index_path = output_dir / "index.json"
    index_path.write_text(
        json.dumps(index_payload, allow_nan=False, ensure_ascii=False, separators=(",", ":")), encoding="utf-8",
    )

    print(f"Prepared {len(episodes_index)} episodes ({index_path.stat().st_size / 1e6:.2f} MB), bundled={index_payload['bundled_episodes']}")
    for proto in ("execution", "qa"):
        print(f"--- Verification ({proto}) ---")
        for m in MODELS:
            tmap = cat_check[(m["id"], proto)]
            cmeans = {c: fmean(fmean(tmap[t]) for t in ts) for c, ts in CATEGORY_TASKS.items()}
            overall = fmean(cmeans.values())
            print(f"  {m['short']:9s}: " + " ".join(f"{c}={cmeans[c]:5.2f}" for c in CATEGORY_TASKS) + f" | Mean={overall:5.2f}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, required=True, help="Root directory containing the 18 model/protocol folders.")
    parser.add_argument("--output-dir", type=Path, required=True, help="Output directory (e.g. RoboMetriX-Page/public/data).")
    parser.add_argument("--task-covers-dir", type=Path, default=None, help="Optional directory to write 20 task cover JPEGs.")
    parser.add_argument("--bundle-mode", choices=("none", "curated", "all"), default="curated",
                        help="Which episodes to export full timeline.json + video.mp4 + frames for.")
    parser.add_argument("--no-strip-header", action="store_true",
                        help="Keep original 1280x720 video instead of cropping the top 48px legacy title bar.")
    args = parser.parse_args()

    source_root = args.source_root.resolve()
    if args.output_dir.is_symlink():
        parser.error("--output-dir cannot be a symlink")
    destination = args.output_dir.resolve()
    if source_root.is_relative_to(destination):
        parser.error("--output-dir cannot contain --source-root")
    if destination.exists() and not destination.is_dir():
        parser.error("--output-dir must be a directory")

    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=f".{destination.name}-", dir=destination.parent) as temporary:
            staging = Path(temporary)
            bundle = staging / "bundle"
            covers = args.task_covers_dir.resolve() if args.task_covers_dir is not None else None
            staged_covers = None
            if covers is not None:
                staged_covers = (
                    bundle / covers.relative_to(destination) if covers.is_relative_to(destination) else staging / "covers"
                )
            status = export_bundle(source_root, bundle, staged_covers, args.bundle_mode, strip_header=not args.no_strip_header)
            if status != 0:
                return status
            if covers is not None and staged_covers == staging / "covers" and staged_covers.is_dir():
                covers.mkdir(parents=True, exist_ok=True)
                for cover in staged_covers.iterdir():
                    shutil.copy2(cover, covers / cover.name)

            previous = staging / "previous"
            try:
                if destination.exists():
                    destination.rename(previous)
                bundle.rename(destination)
            except BaseException:
                if previous.exists() and not destination.exists():
                    previous.rename(destination)
                raise
    except (OSError, ValueError, RuntimeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"Published web bundle to {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
