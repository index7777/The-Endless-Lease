"use client";

import { useEffect, useRef } from "react";

type Vec3 = [number, number, number];
type Angles = { x: number; y: number; z: number };

const FACE_CONFIG = [
  { value: 1, normal: [0, 1, 0] as Vec3, u: [1, 0, 0] as Vec3, v: [0, 0, 1] as Vec3 },
  { value: 6, normal: [0, -1, 0] as Vec3, u: [1, 0, 0] as Vec3, v: [0, 0, -1] as Vec3 },
  { value: 2, normal: [0, 0, 1] as Vec3, u: [1, 0, 0] as Vec3, v: [0, -1, 0] as Vec3 },
  { value: 5, normal: [0, 0, -1] as Vec3, u: [-1, 0, 0] as Vec3, v: [0, -1, 0] as Vec3 },
  { value: 3, normal: [1, 0, 0] as Vec3, u: [0, 0, -1] as Vec3, v: [0, -1, 0] as Vec3 },
  { value: 4, normal: [-1, 0, 0] as Vec3, u: [0, 0, 1] as Vec3, v: [0, -1, 0] as Vec3 },
] as const;

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-.42, -.42], [.42, .42]], 3: [[-.42, -.42], [0, 0], [.42, .42]],
  4: [[-.42, -.42], [.42, -.42], [-.42, .42], [.42, .42]],
  5: [[-.42, -.42], [.42, -.42], [0, 0], [-.42, .42], [.42, .42]],
  6: [[-.42, -.48], [-.42, 0], [-.42, .48], [.42, -.48], [.42, 0], [.42, .48]],
};

const finalAngles = (value: number): Angles => ({
  x: value === 6 ? Math.PI : value === 2 ? -Math.PI / 2 : value === 5 ? Math.PI / 2 : 0,
  y: 0,
  z: value === 3 ? Math.PI / 2 : value === 4 ? -Math.PI / 2 : 0,
});
const rotate = ([x0, y0, z0]: Vec3, a: Angles): Vec3 => {
  let x = x0, y = y0, z = z0;
  [y, z] = [y * Math.cos(a.x) - z * Math.sin(a.x), y * Math.sin(a.x) + z * Math.cos(a.x)];
  [x, z] = [x * Math.cos(a.y) + z * Math.sin(a.y), -x * Math.sin(a.y) + z * Math.cos(a.y)];
  [x, y] = [x * Math.cos(a.z) - y * Math.sin(a.z), x * Math.sin(a.z) + y * Math.cos(a.z)];
  return [x, y, z];
};
const add = (a: Vec3, b: Vec3, scale = 1): Vec3 => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];

export function DiceModel({ value, rolling, seed = 0, label }: { value: number; rolling: boolean; seed?: number; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastAngles = useRef<Angles>({ x: 0, y: 0, z: 0 });
  const settleFrom = useRef<Angles>({ x: 0, y: 0, z: 0 });
  const settleAt = useRef(0);
  const wasRolling = useRef(false);

  useEffect(() => {
    let frame = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const render = (now: number) => {
      if (wasRolling.current && !rolling) { settleFrom.current = { ...lastAngles.current }; settleAt.current = now; }
      wasRolling.current = rolling;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth || 160, height = canvas.clientHeight || 150;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
      const target = finalAngles(value);
      let angles: Angles;
      let lift = 0;
      if (rolling) {
        const t = now / 1000 + seed * .173;
        angles = { x: t * 8.4, y: t * 6.7, z: t * 4.1 };
        lift = 9 + Math.abs(Math.sin(t * 9.2)) * 13;
      } else {
        const elapsed = Math.min(1, (now - settleAt.current) / 520);
        const eased = 1 - Math.pow(1 - Math.max(0, elapsed), 3);
        const from = settleAt.current ? settleFrom.current : target;
        angles = { x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased, z: from.z + (target.z - from.z) * eased };
        lift = Math.sin(elapsed * Math.PI * 3) * (1 - elapsed) * 7;
      }
      lastAngles.current = angles;
      const view = (point: Vec3) => rotate(rotate(point, angles), { x: -.48, y: .62, z: 0 });
      const scale = Math.min(width, height) * .31;
      const project = (point: Vec3): [number, number] => [width / 2 + point[0] * scale, height * .57 - lift - point[1] * scale];
      context.save(); context.globalAlpha = .34; context.fillStyle = "#000"; context.beginPath(); context.ellipse(width / 2 + 5, height * .82, scale * .88, scale * .22, 0, 0, Math.PI * 2); context.fill(); context.restore();

      const faces = FACE_CONFIG.map(face => {
        const center = view(face.normal), u = view(face.u), v = view(face.v);
        const corners = [add(add(center, u, -.88), v, -.88), add(add(center, u, .88), v, -.88), add(add(center, u, .88), v, .88), add(add(center, u, -.88), v, .88)];
        return { ...face, center, u, v, corners, normal: view(face.normal) };
      }).filter(face => face.normal[2] > 0).sort((a, b) => a.center[2] - b.center[2]);
      for (const face of faces) {
        const points = face.corners.map(project);
        const light = Math.max(.55, .82 + face.normal[0] * -.12 + face.normal[1] * .18);
        context.beginPath(); points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y)); context.closePath();
        context.fillStyle = `rgb(${Math.round(205 * light)},${Math.round(194 * light)},${Math.round(164 * light)})`; context.fill();
        context.strokeStyle = "#564b38"; context.lineWidth = 1.6; context.stroke();
        for (const [px, py] of PIPS[face.value]) {
          const position = add(add(face.center, face.u, px * 1.25), face.v, py * 1.25); const [x, y] = project(position);
          context.beginPath(); context.arc(x, y, Math.max(2.3, scale * .075), 0, Math.PI * 2); context.fillStyle = "#211e18"; context.fill();
        }
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [rolling, seed, value]);

  return <canvas ref={canvasRef} className="dice-model" role="img" aria-label={`${label}，${value} 點`} />;
}

