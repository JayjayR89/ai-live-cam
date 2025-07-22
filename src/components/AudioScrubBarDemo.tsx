import React, { useState, useEffect } from 'react';
import { AudioScrubBar } from './AudioScrubBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, Square } from 'lucide-react';

export const AudioScrubBarDemo: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120); // 2 minutes demo
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Simulate audio playback
  useEffect(() => {
    if (isPlaying) {
      const id = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return prev + 0.1;
        });
      }, 100);
      setIntervalId(id);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPlaying, duration, intervalId]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(Math.min(Math.max(0, time), duration));
  };

  return (
    <Card className="p-6 max-w-md mx-auto">
      <h3 className="text-lg font-semibold mb-4">AudioScrubBar Demo</h3>
      
      {/* Control Buttons */}
      <div className="flex gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePlay}
          disabled={isPlaying}
        >
          <Play className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
          disabled={!isPlaying}
        >
          <Pause className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>

      {/* AudioScrubBar Component */}
      <AudioScrubBar
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={handleSeek}
        className="mb-4"
      />

      {/* Status Display */}
      <div className="text-sm text-muted-foreground">
        Status: {isPlaying ? 'Playing' : 'Paused'} | 
        Progress: {Math.round((currentTime / duration) * 100)}%
      </div>
    </Card>
  );
};