
import React, { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Minimize2, Maximize2, Loader } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Add imports for TensorFlow.js
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onFlipCamera: () => void;
  isCameraLoading: boolean;
  videoLoaded: boolean;
  availableCameras: MediaDeviceInfo[];
  showFlipButton?: boolean;
  // New props for detection
  realTimeDetection?: boolean;
  detectionClasses?: string[];
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  videoRef,
  isMinimized,
  onToggleMinimize,
  onFlipCamera,
  isCameraLoading,
  videoLoaded,
  availableCameras,
  showFlipButton = true,
  realTimeDetection = false,
  detectionClasses = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const detectionLoopRef = useRef<number | null>(null);

  // Load model on mount if detection enabled
  useEffect(() => {
    if (!realTimeDetection) return;
    let isMounted = true;
    cocoSsd.load().then(model => {
      if (isMounted) modelRef.current = model;
    });
    return () => { isMounted = false; };
  }, [realTimeDetection]);

  // Detection loop
  useEffect(() => {
    if (!realTimeDetection || !videoLoaded || !videoRef.current || !canvasRef.current || !modelRef.current) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }
    let stopped = false;
    const detect = async () => {
      if (!videoRef.current || !canvasRef.current || !modelRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      try {
        const predictions = await modelRef.current.detect(video);
        predictions.forEach(pred => {
          if (!detectionClasses.includes(pred.class)) return;
          // Draw bounding box
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 2;
          ctx.strokeRect(...pred.bbox);
          // Draw label
          ctx.font = '16px sans-serif';
          ctx.fillStyle = '#00FF00';
          ctx.fillText(pred.class, pred.bbox[0], pred.bbox[1] > 20 ? pred.bbox[1] - 5 : 10);
        });
      } catch (e) {
        // ignore
      }
      if (!stopped) {
        detectionLoopRef.current = window.requestAnimationFrame(detect);
      }
    };
    detectionLoopRef.current = window.requestAnimationFrame(detect);
    return () => {
      stopped = true;
      if (detectionLoopRef.current) window.cancelAnimationFrame(detectionLoopRef.current);
    };
  }, [realTimeDetection, videoLoaded, detectionClasses, videoRef]);

  return (
    <Card className={`relative transition-all duration-300 ${
      isMinimized ? 'w-auto h-[30vh]' : 'w-full'
    }`}>
      <div className={`bg-muted/20 rounded-lg overflow-hidden camera-preview relative ${
        isMinimized ? 'aspect-video h-full' : 'aspect-video'
      }`}>
        {isCameraLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader className="h-8 w-8 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading camera...</p>
            </div>
          </div>
        )}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ aspectRatio: '16/9' }}
        />
        {/* Detection Canvas Overlay */}
        {realTimeDetection && (
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
            style={{ aspectRatio: '16/9' }}
          />
        )}
        {/* Top Left - Minimize/Maximize Button */}
        <Button 
          variant="secondary" 
          size="icon" 
          onClick={onToggleMinimize} 
          className="absolute top-4 left-4 bg-black/50 hover:bg-black/70 z-20"
          title={isMinimized ? "Expand camera preview" : "Minimize camera preview"}
        >
          {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </Button>
        {/* Top Right - Flip Camera Button - Always show when camera is ready and multiple cameras available */}
        {showFlipButton && availableCameras.length > 1 && videoLoaded && !isMinimized && (
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={onFlipCamera} 
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 z-20"
            disabled={isCameraLoading}
            title="Switch camera (front/back)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
};
