import { useEffect, useRef } from "react";

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export function FloatingOrbs() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const orbs: Orb[] = [];
    const orbCount = 4;

    // Create orbs
    for (let i = 0; i < orbCount; i++) {
      orbs.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        radius: 100 + Math.random() * 150,
        color: i % 2 === 0 
          ? "rgba(59, 130, 246, 0.08)" 
          : "rgba(99, 102, 241, 0.06)"
      });
    }

    const animate = () => {
      orbs.forEach((orb) => {
        orb.x += orb.vx;
        orb.y += orb.vy;

        // Bounce off edges
        if (orb.x <= 0 || orb.x >= 100) orb.vx *= -1;
        if (orb.y <= 0 || orb.y >= 100) orb.vy *= -1;

        // Keep in bounds
        orb.x = Math.max(0, Math.min(100, orb.x));
        orb.y = Math.max(0, Math.min(100, orb.y));
      });

      // Update DOM
      orbs.forEach((orb, i) => {
        const element = container.children[i] as HTMLElement;
        if (element) {
          element.style.left = `${orb.x}%`;
          element.style.top = `${orb.y}%`;
          element.style.width = `${orb.radius}px`;
          element.style.height = `${orb.radius}px`;
        }
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            background: i % 2 === 0
              ? "radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent 70%)"
              : "radial-gradient(circle, rgba(99, 102, 241, 0.12), transparent 70%)",
            transition: "all 0.1s linear"
          }}
        />
      ))}
    </div>
  );
}

