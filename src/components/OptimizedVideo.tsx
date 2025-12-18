import { useEffect, useRef, useState, useCallback } from "react";

interface OptimizedVideoProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  fallback?: React.ReactNode;
  playWithSoundOnScroll?: boolean;
}

export function OptimizedVideo({
  src,
  className = "",
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  fallback,
  playWithSoundOnScroll = false,
}: OptimizedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);

  // Track user interaction to enable unmuted playback
  useEffect(() => {
    if (!playWithSoundOnScroll) return;

    const handleInteraction = () => {
      setHasUserInteracted(true);
      // Remove listeners after first interaction
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);
    document.addEventListener("keydown", handleInteraction);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
  }, [playWithSoundOnScroll]);

  // Intersection Observer for scroll-triggered playback
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const inView = entry.isIntersecting && entry.intersectionRatio > 0.5;
          setIsInViewport(inView);
        });
      },
      {
        rootMargin: "0px",
        threshold: [0, 0.5, 1],
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Handle play/pause and sound based on viewport and user interaction
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLoading) return;

    if (isInViewport) {
      // Video is in view - play it
      video.play().catch(() => {
        // Autoplay blocked, will play muted
      });

      // If user has interacted and playWithSoundOnScroll is enabled, unmute
      if (playWithSoundOnScroll && hasUserInteracted) {
        video.muted = false;
        setIsMuted(false);
      }
    } else {
      // Video out of view - pause and reset to muted state
      video.pause();
      if (playWithSoundOnScroll) {
        video.muted = true;
        setIsMuted(true);
      }
    }
  }, [isInViewport, hasUserInteracted, playWithSoundOnScroll, isLoading]);

  const handleLoadedData = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !video.muted;
    video.muted = newMuted;
    setIsMuted(newMuted);
    setHasUserInteracted(true);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <video
        ref={videoRef}
        className={className}
        autoPlay={autoPlay}
        loop={loop}
        muted={isMuted}
        playsInline={playsInline}
        preload="auto" // Instant loading - loads entire video
        src={src}
        onLoadedData={handleLoadedData}
        onError={handleError}
        onCanPlay={handleCanPlay}
        style={{
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease-in-out",
        }}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-white/60 text-sm">Loading video...</p>
          </div>
        </div>
      )}

      {/* Error state with fallback */}
      {hasError && fallback && (
        <div className="absolute inset-0">{fallback}</div>
      )}

      {/* Sound toggle button - only show when playWithSoundOnScroll is enabled */}
      {playWithSoundOnScroll && !isLoading && !hasError && (
        <button
          onClick={toggleMute}
          className="absolute bottom-4 right-4 z-10 bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full transition-all backdrop-blur-sm border border-white/20"
          aria-label={isMuted ? "Unmute video" : "Mute video"}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
