
import { useState, useEffect, useCallback } from 'react';

interface AutoCaptureSettings {
  enabled: boolean;
  captureTime: number;
  captureAmount: number;
  captureQuality: 'high' | 'medium' | 'low';
}

interface AutoCaptureState {
  isActive: boolean;
  currentCount: number;
  remainingTime: number;
  progress: number;
}

export const useAutoCapture = (
  settings: AutoCaptureSettings,
  onCapture: () => void,
  isReady: boolean
) => {
  const [state, setState] = useState<AutoCaptureState>({
    isActive: false,
    currentCount: 0,
    remainingTime: 0,
    progress: 0
  });

  const startAutoCapture = useCallback(() => {
    if (!isReady || !settings.enabled) return;
    
    setState({
      isActive: true,
      currentCount: 0,
      remainingTime: settings.captureTime,
      progress: 0
    });
  }, [isReady, settings.enabled, settings.captureTime]);

  const stopAutoCapture = useCallback(() => {
    setState({
      isActive: false,
      currentCount: 0,
      remainingTime: 0,
      progress: 0
    });
  }, []);

  useEffect(() => {
    if (!state.isActive) return;

    const interval = setInterval(() => {
      setState(prev => {
        if (prev.remainingTime <= 1) {
          // Time to capture
          onCapture();
          
          const newCount = prev.currentCount + 1;
          if (newCount >= settings.captureAmount) {
            // Auto-capture complete
            return {
              isActive: false,
              currentCount: 0,
              remainingTime: 0,
              progress: 0
            };
          }
          
          // Reset for next capture
          return {
            ...prev,
            currentCount: newCount,
            remainingTime: settings.captureTime,
            progress: 0
          };
        }
        
        // Continue countdown
        const newRemainingTime = prev.remainingTime - 1;
        const progress = ((settings.captureTime - newRemainingTime) / settings.captureTime) * 100;
        
        return {
          ...prev,
          remainingTime: newRemainingTime,
          progress
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isActive, settings.captureTime, settings.captureAmount, onCapture]);

  return {
    ...state,
    startAutoCapture,
    stopAutoCapture
  };
};
