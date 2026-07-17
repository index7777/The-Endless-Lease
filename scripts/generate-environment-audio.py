from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
DURATION = 24
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "audio" / "ambience"


def envelope(index: int, length: int) -> float:
    edge = min(index, length - 1 - index) / (RATE * .35)
    return max(0.0, min(1.0, edge))


def render(name: str, seed: int, low_hz: float, hum_hz: float, events: str) -> None:
    random.seed(seed)
    length = RATE * DURATION
    drift = 0.0
    event_times = sorted(random.uniform(1.5, DURATION - 1.5) for _ in range(16))
    samples: list[int] = []
    for index in range(length):
        t = index / RATE
        drift = drift * .997 + random.uniform(-1, 1) * .003
        value = math.sin(math.tau * low_hz * t) * .14
        value += math.sin(math.tau * hum_hz * t + math.sin(t * .19) * .4) * .035
        value += drift * .18
        for event_time in event_times:
            dt = t - event_time
            if not 0 <= dt <= .55:
                continue
            if events == "pipes":
                value += math.sin(math.tau * (190 - dt * 90) * dt) * math.exp(-dt * 10) * .17
            elif events == "drips":
                value += (math.sin(math.tau * 820 * dt) + math.sin(math.tau * 1210 * dt) * .4) * math.exp(-dt * 34) * .12
            elif events == "paper":
                value += random.uniform(-1, 1) * math.sin(math.pi * min(1, dt / .3)) * .055
            elif events == "relay":
                value += random.uniform(-1, 1) * math.exp(-dt * 52) * .12
            elif events == "clock":
                value += math.sin(math.tau * 1180 * dt) * math.exp(-dt * 80) * .055
        value *= envelope(index, length)
        samples.append(max(-32767, min(32767, round(value * 32767 * .62))))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT / name), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(RATE)
        target.writeframes(b"".join(struct.pack("<h", sample) for sample in samples))


render("floor-common-v1.wav", 1701, 47.0, 119.6, "pipes")
render("b1-machinery-v1.wav", 1702, 38.0, 58.4, "drips")
render("b2-records-v1.wav", 1703, 42.5, 89.8, "paper")
render("elevator-cabin-v1.wav", 1704, 31.0, 62.0, "relay")
render("management-office-v1.wav", 1705, 44.0, 99.7, "clock")
