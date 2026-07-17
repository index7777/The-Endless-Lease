from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


FRAME_W = 512
FRAME_H = 384
STATE_NAMES = ("walk", "attack", "hit", "die")


def optical_blend(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    if t <= 0:
        return a.copy()
    if t >= 1:
        return b.copy()
    a_rgb = cv2.cvtColor(a[:, :, :3], cv2.COLOR_RGB2GRAY)
    b_rgb = cv2.cvtColor(b[:, :, :3], cv2.COLOR_RGB2GRAY)
    flow_ab = cv2.calcOpticalFlowFarneback(a_rgb, b_rgb, None, .5, 3, 21, 3, 5, 1.1, 0)
    flow_ba = cv2.calcOpticalFlowFarneback(b_rgb, a_rgb, None, .5, 3, 21, 3, 5, 1.1, 0)
    grid_x, grid_y = np.meshgrid(np.arange(FRAME_W, dtype=np.float32), np.arange(FRAME_H, dtype=np.float32))
    warp_a = cv2.remap(a, grid_x - flow_ab[:, :, 0] * t, grid_y - flow_ab[:, :, 1] * t, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    warp_b = cv2.remap(b, grid_x - flow_ba[:, :, 0] * (1 - t), grid_y - flow_ba[:, :, 1] * (1 - t), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    return np.clip(warp_a.astype(np.float32) * (1 - t) + warp_b.astype(np.float32) * t, 0, 255).astype(np.uint8)


def interpolate_state(keys: list[np.ndarray], loop: bool) -> list[np.ndarray]:
    frames: list[np.ndarray] = []
    for frame_index in range(16):
        position = frame_index * (4 / 16 if loop else 3 / 15)
        left = int(np.floor(position))
        amount = position - left
        right = (left + 1) % 4 if loop else min(3, left + 1)
        frames.append(optical_blend(keys[left % 4], keys[right], amount))
    return frames


def main() -> None:
    parser = argparse.ArgumentParser(description="Interpolate four animation key poses per state to sixteen 24 FPS frames.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--character", required=True)
    args = parser.parse_args()

    source = np.array(Image.open(args.input).convert("RGBA"))
    if source.shape[1] != FRAME_W * 4 or source.shape[0] != FRAME_H * 4:
        raise ValueError("input must be a normalized 4x4 sheet of 512x384 cells")

    all_frames: list[np.ndarray] = []
    states: dict[str, dict[str, object]] = {}
    for row, state in enumerate(STATE_NAMES):
        keys = [source[row * FRAME_H:(row + 1) * FRAME_H, column * FRAME_W:(column + 1) * FRAME_W] for column in range(4)]
        frames = interpolate_state(keys, loop=state == "walk")
        start = len(all_frames)
        all_frames.extend(frames)
        states[state] = {"startFrame": start, "frameCount": 16, "fps": 24, "loop": state == "walk"}

    sheet = np.zeros((FRAME_H * 8, FRAME_W * 8, 4), dtype=np.uint8)
    for index, frame in enumerate(all_frames):
        x = (index % 8) * FRAME_W
        y = (index // 8) * FRAME_H
        sheet[y:y + FRAME_H, x:x + FRAME_W] = frame
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet, "RGBA").save(output, optimize=True)

    manifest = {
        "schemaVersion": 1,
        "character": args.character,
        "status": "candidate",
        "sourceType": "AI key poses normalized then OpenCV optical-flow interpolation",
        "frameSize": {"width": FRAME_W, "height": FRAME_H},
        "sheet": {"columns": 8, "rows": 8},
        "groundLine": 372,
        "pivot": "feet_center",
        "states": states,
    }
    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
