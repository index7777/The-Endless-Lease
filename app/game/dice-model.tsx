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

export function DiceRollScene({ values, rolling }: { values: readonly number[]; rolling: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    const startedAt = performance.now();
    const render = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth || 760, height = canvas.clientHeight || 390;
      if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) { canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr); }
      context.setTransform(dpr,0,0,dpr,0,0); context.clearRect(0,0,width,height);
      const table = context.createRadialGradient(width*.52,height*.42,20,width*.5,height*.5,width*.72);
      table.addColorStop(0,"#55452f"); table.addColorStop(.45,"#2b241b"); table.addColorStop(1,"#080a08");
      context.fillStyle=table; context.fillRect(0,0,width,height);
      context.fillStyle="rgba(220,192,139,.06)"; for(let i=0;i<90;i++) context.fillRect((i*83)%width,(i*47)%height,1+(i%2),1);
      const elapsed=(now-startedAt)/1000;
      const dieSize=Math.min(width/9.3,height/4.3);
      const destinations = values.map((_,index)=>({x:width*(.24+(index%3)*.26),y:height*(index<3?.38:.72)}));
      destinations.forEach((destination,index)=>{
        const seed=index*1.731;
        const motion=rolling ? 1 : Math.max(0,1-elapsed/0.55);
        const flight=rolling ? Math.abs(Math.sin(elapsed*6.5+seed)) : Math.sin(Math.min(1,elapsed/.55)*Math.PI*2.5)*motion;
        const cx=destination.x + Math.sin(elapsed*4.1+seed)*width*.065*motion;
        const cy=destination.y - Math.abs(flight)*height*.16*motion;
        const angles:Angles=rolling
          ? {x:elapsed*(7.4+index*.3)+seed,y:elapsed*(6.1+index*.23),z:elapsed*(3.2+index*.17)}
          : finalAngles(values[index] ?? 1);
        const view=(point:Vec3)=>rotate(rotate(point,angles),{x:-.48,y:.62,z:0});
        const project=(point:Vec3):[number,number]=>[cx+point[0]*dieSize,cy-point[1]*dieSize];
        const shadowScale=1-Math.min(.55,Math.abs(flight)*.42*motion);
        context.save(); context.globalAlpha=.5*shadowScale; context.filter="blur(5px)"; context.fillStyle="#000"; context.beginPath(); context.ellipse(cx+6,destination.y+dieSize*.72,dieSize*.95*shadowScale,dieSize*.24*shadowScale,0,0,Math.PI*2); context.fill(); context.restore();
        const faces=FACE_CONFIG.map(face=>{const center=view(face.normal),u=view(face.u),v=view(face.v);const corners=[add(add(center,u,-.84),v,-.84),add(add(center,u,.84),v,-.84),add(add(center,u,.84),v,.84),add(add(center,u,-.84),v,.84)];return{...face,center,u,v,corners,normal:view(face.normal)}}).filter(face=>face.normal[2]>0).sort((a,b)=>a.center[2]-b.center[2]);
        for(const face of faces){
          const points=face.corners.map(project); const light=Math.max(.48,.84+face.normal[0]*-.16+face.normal[1]*.22);
          const gradient=context.createLinearGradient(points[0][0],points[0][1],points[2][0],points[2][1]);
          gradient.addColorStop(0,`rgb(${Math.round(238*light)},${Math.round(226*light)},${Math.round(193*light)})`);gradient.addColorStop(1,`rgb(${Math.round(169*light)},${Math.round(157*light)},${Math.round(130*light)})`);
          context.beginPath();points.forEach(([x,y],pointIndex)=>pointIndex?context.lineTo(x,y):context.moveTo(x,y));context.closePath();context.fillStyle=gradient;context.fill();context.strokeStyle="#443b2e";context.lineWidth=2.2;context.stroke();
          context.save();context.clip();context.globalAlpha=.16;context.fillStyle="#594a36";for(let grain=0;grain<8;grain++){const gx=cx+Math.sin(grain*19+index*7)*dieSize*.7,gy=cy+Math.cos(grain*13+index*5)*dieSize*.7;context.fillRect(gx,gy,1.4,1.4)}context.restore();
          for(const [px,py] of PIPS[face.value]){const position=add(add(face.center,face.u,px*1.18),face.v,py*1.18);const [x,y]=project(position);context.beginPath();context.arc(x,y,Math.max(3.2,dieSize*.078),0,Math.PI*2);context.fillStyle="#171715";context.fill();context.strokeStyle="rgba(255,240,205,.18)";context.lineWidth=1;context.stroke()}
        }
      });
      const vignette=context.createRadialGradient(width/2,height/2,height*.18,width/2,height/2,width*.68);vignette.addColorStop(0,"transparent");vignette.addColorStop(1,"rgba(0,0,0,.72)");context.fillStyle=vignette;context.fillRect(0,0,width,height);
      frame=requestAnimationFrame(render);
    };
    frame=requestAnimationFrame(render);
    return()=>cancelAnimationFrame(frame);
  },[rolling,values]);
  return <canvas ref={canvasRef} className="dice-roll-scene" role="img" aria-label="六顆命運骰子投擲場景"/>;
}
