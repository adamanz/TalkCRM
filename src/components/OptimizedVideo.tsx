import { useEffect, useRef, useState } from "react";

interface OptimizedVideoProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  fallback?: React.ReactNode;
}

export function OptimizedVideo({
  src,
  className = "",
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  fallback,
}: OptimizedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // Start loading when 50% visible
            if (entry.intersectionRatio > 0.5) {
              setShouldLoad(true);
            }
          }
        });
      },
      {
        rootMargin: "100px", // Start loading 100px before entering viewport
        threshold: [0, 0.5, 1],
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Video will load automatically when src is set

  const handleLoadedData = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {shouldLoad ? (
        <>
          <video
            ref={videoRef}
            className={className}
            autoPlay={autoPlay}
            loop={loop}
            muted={muted}
            playsInline={playsInline}
            preload="metadata" // Only load metadata initially, not full video
            src={shouldLoad ? src : undefined}
            onLoadedData={handleLoadedData}
            onError={handleError}
            onCanPlay={handleCanPlay}
            style={{
              opacity: isLoading ? 0 : 1,
              transition: "opacity 0.5s ease-in-out",
            }}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-white/60 text-sm">Loading video...</p>
              </div>
            </div>
          )}
          {hasError && fallback && (
            <div className="absolute inset-0">{fallback}</div>
          )}
        </>
      ) : (
        // Placeholder while waiting to load
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500/40 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
}

