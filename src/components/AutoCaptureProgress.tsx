
import React from 'react';

interface AutoCaptureProgressProps {
  progress: number;
  remainingTime: number;
  isActive: boolean;
}

export const AutoCaptureProgress: React.FC<AutoCaptureProgressProps> = ({
  progress,
  remainingTime,
  isActive
}) => {
  if (!isActive) return null;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Next capture in:</span>
        <span>{remainingTime}s</span>
      </div>
      <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
