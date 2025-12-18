import { useEffect, useRef } from "react";

export function VoiceWaves() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const waves = [
      { y: 0.3, amplitude: 20, frequency: 0.02, speed: 0.01, phase: 0 },
      { y: 0.5, amplitude: 30, frequency: 0.015, speed: 0.015, phase: Math.PI / 2 },
      { y: 0.7, amplitude: 25, frequency: 0.018, speed: 0.012, phase: Math.PI },
    ];

    let animationFrame: number;
    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
      ctx.lineWidth = 2;

      waves.forEach((wave) => {
        ctx.beginPath();
        const y = wave.y * canvas.height;
        const points = 200;
        
        for (let i = 0; i <= points; i++) {
          const x = (i / points) * canvas.width;
          const waveY = y + Math.sin((x * wave.frequency) + (time * wave.speed) + wave.phase) * wave.amplitude;
          
          if (i === 0) {
            ctx.moveTo(x, waveY);
          } else {
            ctx.lineTo(x, waveY);
          }
        }
        
        ctx.stroke();
      });

      time += 0.5;
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

