import { useEffect, useRef } from "react";

export function AnimatedGradient() {
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

    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create gradient mesh
      const gradient1 = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient1.addColorStop(0, "rgba(59, 130, 246, 0.03)");
      gradient1.addColorStop(0.5, "rgba(99, 102, 241, 0.02)");
      gradient1.addColorStop(1, "rgba(59, 130, 246, 0.03)");

      const gradient2 = ctx.createRadialGradient(
        canvas.width / 2 + Math.sin(time * 0.001) * 200,
        canvas.height / 2 + Math.cos(time * 0.001) * 200,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height)
      );
      gradient2.addColorStop(0, "rgba(99, 102, 241, 0.04)");
      gradient2.addColorStop(1, "transparent");

      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 1;
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

