import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  colorIdx: number;
}

const COLORS = [
  [124, 58, 237],
  [139, 92, 246],
  [59, 130, 246],
  [167, 139, 250],
  [96, 165, 250],
];

export function ContourLines() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;
    let time = 0;
    let animId: number;
    let particles: Particle[] = [];

    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      particles = Array.from({ length: 80 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.8 + 0.4,
        opacity: Math.random() * 0.45 + 0.08,
        colorIdx: Math.floor(Math.random() * COLORS.length),
      }));
    };

    const noise = (x: number, y: number, t: number) =>
      Math.sin(x * 0.0014 + t * 0.65) * Math.cos(y * 0.0014 + t * 0.45) * 75 +
      Math.sin(x * 0.0028 + y * 0.0018 + t * 1.1) * 28 +
      Math.cos(x * 0.001 - y * 0.002 + t * 0.8) * 20;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      time += 0.0035;

      const lineCount = 22;
      const spacing = h / lineCount;

      for (let i = 0; i < lineCount; i++) {
        ctx.beginPath();
        const yBase = i * spacing;
        const progress = i / lineCount;
        const alpha = 0.08 + progress * 0.55;

        for (let x = 0; x <= w; x += 7) {
          const y = yBase + noise(x, yBase, time);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0,    `rgba(124, 58, 237, 0)`);
        grad.addColorStop(0.2,  `rgba(124, 58, 237, ${alpha * 0.35})`);
        grad.addColorStop(0.55, `rgba(99, 102, 241, ${alpha * 0.65})`);
        grad.addColorStop(0.8,  `rgba(59, 130, 246, ${alpha * 0.85})`);
        grad.addColorStop(1,    `rgba(59, 130, 246, ${alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        else if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        else if (p.y > h) p.y = 0;

        const [r, g, b] = COLORS[p.colorIdx];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    init();
    draw();

    const onResize = () => init();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
