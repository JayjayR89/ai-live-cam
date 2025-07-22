import React, { useCallback, useEffect, memo } from 'react';
import { Play, Square, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioScrubBar } from './AudioScrubBar';
import { useTTSAudio, TTSConfig } from '@/hooks/useTTSAudio';
import { useTTSSettings } from '@/contexts/TTSSettingsContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { TTSErrorBoundary } from './ErrorBoundary';
import { handleTTSError } from '@/lib/errorHandling';
import { LoadingIndicator } from './LoadingIndicator';

interface TTSControlsProps {
  text: string;
  config?: Partial<TTSConfig>;
  className?: string;
  showScrubBar?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: string) => void;
}

const TTSControlsInner: React.FC<TTSControlsProps> = memo(({
  text,
  config,
  className,
  showScrubBar = true,
  variant = 'outline',
  size = 'sm',
  disabled = false,
  onPlayStart,
  onPlayEnd,
  onError
}) => {
  // Use context settings as fallback if no config provided
  const { ttsConfig } = useTTSSettings();
  const effectiveConfig = config || ttsConfig;

  const {
    isPlaying,
    isLoading,
    currentTime,
    duration,
    progress,
    error,
    play,
    stop,
    seek
  } = useTTSAudio(effectiveConfig);

  // Handle play button click with enhanced error handling
  const handlePlay = useCallback(async () => {
    if (!text?.trim()) {
      const errorMsg = 'No text available for TTS';
      handleTTSError(new Error(errorMsg), {
        component: 'TTSControls',
        action: 'play_empty_text'
      });
      onError?.(errorMsg);
      return;
    }

    try {
      onPlayStart?.();
      await play(text, effectiveConfig);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('TTS playback failed');
      const errorId = handleTTSError(error, {
        component: 'TTSControls',
        action: 'play_audio',
        additionalData: { 
          textLength: text.length,
          config: effectiveConfig 
        }
      });
      onError?.(error.message);
    }
  }, [text, effectiveConfig, play, onPlayStart, onError]);

  // Handle stop button click
  const handleStop = useCallback(() => {
    try {
      stop();
      onPlayEnd?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('TTS stop failed');
      handleTTSError(error, {
        component: 'TTSControls',
        action: 'stop_audio'
      });
    }
  }, [stop, onPlayEnd]);

  // Handle seeking with error handling
  const handleSeek = useCallback((time: number) => {
    try {
      seek(time);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('TTS seek failed');
      handleTTSError(error, {
        component: 'TTSControls',
        action: 'seek_audio',
        additionalData: { seekTime: time }
      });
    }
  }, [seek]);

  // Handle errors from the hook
  useEffect(() => {
    if (error) {
      handleTTSError(new Error(error), {
        component: 'TTSControls',
        action: 'hook_error'
      });
      onError?.(error);
    }
  }, [error, onError]);

  // Handle play end
  useEffect(() => {
    if (!isPlaying && !isLoading && currentTime === 0 && duration > 0) {
      // Audio has ended naturally
      onPlayEnd?.();
    }
  }, [isPlaying, isLoading, currentTime, duration, onPlayEnd]);

  const isDisabled = disabled || !text?.trim();

  return (
    <div 
      className={cn(
        "flex flex-col gap-2 w-full",
        className
      )}
      role="group"
      aria-label="Text-to-speech controls"
    >
      {/* Loading overlay for better UX */}
      {isLoading && (
        <div className="relative">
          <LoadingIndicator
            type="tts"
            size="sm"
            variant="inline"
            message="Generating speech..."
          />
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {/* Play Button */}
        <Button
          variant={variant}
          size={size}
          onClick={handlePlay}
          disabled={isDisabled || isPlaying || isLoading}
          className={cn(
            "flex items-center gap-2",
            isLoading && "cursor-not-allowed"
          )}
          aria-label={isLoading ? "Loading TTS audio..." : "Play text-to-speech"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isLoading ? 'Loading...' : 'Play'}
        </Button>

        {/* Stop Button */}
        <Button
          variant={variant}
          size={size}
          onClick={handleStop}
          disabled={!isPlaying && !isLoading}
          className="flex items-center gap-2"
          aria-label="Stop text-to-speech playback"
        >
          <Square className="h-4 w-4" />
          Stop
        </Button>

        {/* Error Indicator */}
        {error && (
          <div 
            className="flex items-center gap-1 text-destructive text-sm"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="h-4 w-4" />
            <span className="sr-only">Error: {error}</span>
          </div>
        )}
      </div>

      {/* Audio Scrub Bar - Only show when playing or has duration */}
      {showScrubBar && (isPlaying || duration > 0) && (
        <div className="w-full">
          <AudioScrubBar
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            className="w-full"
          />
        </div>
      )}

      {/* Status Text for Screen Readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading && "Loading text-to-speech audio..."}
        {isPlaying && `Playing text-to-speech: ${Math.round(progress)}% complete`}
        {error && `Text-to-speech error: ${error}`}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo optimization
  return (
    prevProps.text === nextProps.text &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.showScrubBar === nextProps.showScrubBar &&
    prevProps.variant === nextProps.variant &&
    prevProps.size === nextProps.size &&
    prevProps.className === nextProps.className &&
    JSON.stringify(prevProps.config) === JSON.stringify(nextProps.config)
  );
});

// Add display name for debugging
TTSControlsInner.displayName = 'TTSControlsInner';

// Wrap with error boundary
export const TTSControls: React.FC<TTSControlsProps> = (props) => (
  <TTSErrorBoundary>
    <TTSControlsInner {...props} />
  </TTSErrorBoundary>
);

// Export types for external use
export type { TTSControlsProps };