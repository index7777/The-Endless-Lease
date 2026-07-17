from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageStat


def remove_chroma_green(image: Image.Image) -> Image.Image:
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            dominance = green - max(red, blue)
            if green > 60 and dominance > 12:
                remaining = max(0, min(255, 255 - (dominance - 12) * 5))
                pixels[x, y] = (red, min(green, max(red, blue) + 6), blue, min(alpha, remaining))
    return image


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("frame has no visible pixels")
    return bbox


def keep_largest_component(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    largest: list[tuple[int, int]] = []
    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or pixels[x, y] < 32:
                continue
            visited[offset] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for next_x, next_y in ((current_x - 1, current_y), (current_x + 1, current_y), (current_x, current_y - 1), (current_x, current_y + 1)):
                    if next_x < 0 or next_y < 0 or next_x >= width or next_y >= height:
                        continue
                    next_offset = next_y * width + next_x
                    if visited[next_offset] or pixels[next_x, next_y] < 32:
                        continue
                    visited[next_offset] = 1
                    queue.append((next_x, next_y))
            if len(component) > len(largest):
                largest = component
    if not largest:
        return image
    component_mask = Image.new("L", (width, height), 0)
    component_pixels = component_mask.load()
    for x, y in largest:
        component_pixels[x, y] = 255
    component_mask = component_mask.filter(ImageFilter.MaxFilter(5))
    result = image.copy()
    result.putalpha(ImageChops.multiply(alpha, component_mask))
    return result


def weighted_luma(image: Image.Image) -> float:
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    stat = ImageStat.Stat(rgb, mask=alpha)
    r, g, b = stat.mean
    return max(1.0, r * .2126 + g * .7152 + b * .0722)


def split_grid(source: Image.Image, columns: int, rows: int) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for row in range(rows):
        top = round(row * source.height / rows)
        bottom = round((row + 1) * source.height / rows)
        for column in range(columns):
            left = round(column * source.width / columns)
            right = round((column + 1) * source.width / columns)
            frames.append(source.crop((left, top, right, bottom)))
    return frames


def clear_frame_guides(frame: Image.Image, border: int = 5) -> Image.Image:
    """Remove contact-sheet rules touching cell edges before component selection."""
    alpha = frame.getchannel("A")
    mask = Image.new("L", frame.size, 255)
    mask_pixels = mask.load()
    for y in range(frame.height):
        for x in range(frame.width):
            if x < border or y < border or x >= frame.width - border or y >= frame.height - border:
                mask_pixels[x, y] = 0
    frame.putalpha(ImageChops.multiply(alpha, mask))
    return frame


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize a generated animation contact sheet.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--character", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--frame-width", type=int, default=512)
    parser.add_argument("--frame-height", type=int, default=384)
    parser.add_argument("--ground-y", type=int, default=372)
    parser.add_argument("--target-height", type=int, default=340)
    args = parser.parse_args()

    source = remove_chroma_green(Image.open(args.input).convert("RGBA"))
    raw_frames = [keep_largest_component(clear_frame_guides(frame)) for frame in split_grid(source, args.columns, args.rows)]
    bboxes = [alpha_bbox(frame) for frame in raw_frames]
    reference_height = bboxes[0][3] - bboxes[0][1]
    scale = args.target_height / max(1, reference_height)
    lumas = [weighted_luma(frame.crop(bbox)) for frame, bbox in zip(raw_frames, bboxes)]
    target_luma = sorted(lumas)[len(lumas) // 2]

    sheet = Image.new("RGBA", (args.frame_width * args.columns, args.frame_height * args.rows), (0, 0, 0, 0))
    manifest_frames = []
    for index, (frame, bbox, luma) in enumerate(zip(raw_frames, bboxes, lumas)):
        subject = frame.crop(bbox)
        factor = max(.86, min(1.16, target_luma / luma))
        subject = ImageEnhance.Brightness(subject).enhance(factor)
        width = max(1, round(subject.width * scale))
        height = max(1, round(subject.height * scale))
        if width > args.frame_width - 8:
            fit = (args.frame_width - 8) / width
            width = round(width * fit)
            height = round(height * fit)
        subject = subject.resize((width, height), Image.Resampling.LANCZOS)
        x = round((args.frame_width - width) / 2)
        y = args.ground_y - height
        cell_x = (index % args.columns) * args.frame_width
        cell_y = (index // args.columns) * args.frame_height
        sheet.alpha_composite(subject, (cell_x + x, cell_y + y))
        manifest_frames.append({
            "index": index,
            "rect": {"x": cell_x, "y": cell_y, "w": args.frame_width, "h": args.frame_height},
            "pivot": {"x": .5, "y": args.ground_y / args.frame_height},
            "groundY": args.ground_y,
            "sourceLuma": round(luma, 3),
            "brightnessCorrection": round(factor, 4),
        })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)
    manifest = {
        "schemaVersion": 1,
        "character": args.character,
        "state": args.state,
        "status": "candidate",
        "fps": args.fps,
        "loop": args.state in {"walk", "idle"},
        "frameCount": len(manifest_frames),
        "frameSize": {"width": args.frame_width, "height": args.frame_height},
        "groundLine": args.ground_y,
        "pivot": "feet_center",
        "source": str(Path(args.input).as_posix()),
        "frames": manifest_frames,
    }
    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
