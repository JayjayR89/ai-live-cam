import React, { useCallback, useMemo, memo } from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface AudioScrubBarProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  className?: string;
}

export const AudioScrubBar: React.FC<AudioScrubBarProps> = memo(({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  className
}) => {
  // Format time in MM:SS format
  const formatTime = useCallback((timeInSeconds: number): string => {
    if (!isFinite(timeInSeconds) || timeInSeconds < 0) {
      return '0:00';
    }
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Calculate progress percentage for the slider
  const progressPercentage = useMemo(() => {
    if (!duration || duration === 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  // Handle slider value change for seeking
  const handleSliderChange = useCallback((values: number[]) => {
    const percentage = values[0];
    const seekTime = (percentage / 100) * duration;
    onSeek(seekTime);
  }, [duration, onSeek]);

  // Formatted time strings
  const currentTimeFormatted = formatTime(currentTime);
  const durationFormatted = formatTime(duration);

  return (
    <div 
      className={cn(
        "flex items-center gap-3 w-full min-w-0",
        "transition-opacity duration-200",
        isPlaying ? "opacity-100" : "opacity-75",
        className
      )}
      role="group"
      aria-label="Audio progress and controls"
    >
      {/* Current Time Display */}
      <div 
        className="text-xs font-mono text-muted-foreground min-w-[2.5rem] text-right"
        aria-label={`Current time: ${currentTimeFormatted}`}
      >
        {currentTimeFormatted}
      </div>

      {/* Interactive Slider for Seeking */}
      <div className="flex-1 min-w-0">
        <Slider
          value={[progressPercentage]}
          onValueChange={handleSliderChange}
          max={100}
          min={0}
          step={0.1}
          className={cn(
            "w-full cursor-pointer",
            "transition-all duration-200",
            isPlaying && "animate-pulse-subtle"
          )}
          aria-label={`Audio progress: ${Math.round(progressPercentage)}% complete`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPercentage)}
          aria-valuetext={`${currentTimeFormatted} of ${durationFormatted}`}
        />
      </div>

      {/* Duration Display */}
      <div 
        className="text-xs font-mono text-muted-foreground min-w-[2.5rem]"
        aria-label={`Total duration: ${durationFormatted}`}
      >
        {durationFormatted}
      </div>

      {/* Progress Indicator for Screen Readers */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {isPlaying ? 'Playing' : 'Paused'}: {currentTimeFormatted} of {durationFormatted}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo optimization
  // Only re-render if meaningful values have changed
  const timeDiff = Math.abs(prevProps.currentTime - nextProps.currentTime);
  const durationDiff = Math.abs(prevProps.duration - nextProps.duration);
  
  return (
    timeDiff < 0.1 && // Only update if time difference is significant (>0.1s)
    durationDiff < 0.1 && // Only update if duration difference is significant
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.className === nextProps.className &&
    prevProps.onSeek === nextProps.onSeek
  );
});

// Add display name for debugging
AudioScrubBar.displayName = 'AudioScrubBar';

// Add custom CSS for subtle pulse animation
const styles = `
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
  
  .animate-pulse-subtle {
    animation: pulse-subtle 2s ease-in-out infinite;
  }
  
  /* Enhanced focus styles for accessibility */
  .audio-scrub-bar [role="slider"]:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
  
  /* Responsive adjustments */
  @media (max-width: 640px) {
    .audio-scrub-bar {
      gap: 0.5rem;
    }
    
    .audio-scrub-bar .time-display {
      font-size: 0.625rem;
      min-width: 2rem;
    }
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('audio-scrub-bar-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'audio-scrub-bar-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}