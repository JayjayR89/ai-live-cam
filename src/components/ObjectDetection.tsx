import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Target, Zap, ZapOff, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

interface ObjectDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  onToggle: () => void;
  confidence?: number;
  highlightColor?: string;
  showLabels?: boolean;
  onDetection?: (detections: Detection[]) => void;
}

export const ObjectDetection: React.FC<ObjectDetectionProps> = ({
  videoRef,
  isActive,
  onToggle,
  confidence = 0.5,
  highlightColor = '#3B82F6',
  showLabels = true,
  onDetection
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  // Load TensorFlow.js model
  const loadModel = useCallback(async () => {
    if (modelRef.current) return;
    
    setIsModelLoading(true);
    try {
      // Set TensorFlow.js backend
      await tf.ready();
      console.log('TensorFlow.js backend:', tf.getBackend());
      
      // Load COCO-SSD model
      const model = await cocoSsd.load({
        base: 'mobilenet_v2', // Faster but less accurate
        // base: 'lite_mobilenet_v2', // Even faster for mobile
      });
      
      modelRef.current = model;
      setIsModelReady(true);
      setIsModelLoading(false);
      
      toast({
        title: "Object Detection Ready",
        description: "AI model loaded successfully",
        duration: 3000
      });
    } catch (error) {
      console.error('Error loading model:', error);
      setIsModelLoading(false);
      toast({
        title: "Model Loading Failed",
        description: "Could not load object detection model",
        variant: "destructive",
        duration: 5000
      });
    }
  }, []);

  // Detect objects in video frame
  const detectObjects = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current || !isActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      // Run object detection
      const predictions = await modelRef.current.detect(video);
      
      // Filter predictions by confidence
      const filteredPredictions = predictions.filter(
        prediction => prediction.score >= confidence
      );

      // Convert to our Detection interface
      const newDetections: Detection[] = filteredPredictions.map(prediction => ({
        bbox: prediction.bbox,
        class: prediction.class,
        score: prediction.score
      }));

      setDetections(newDetections);
      onDetection?.(newDetections);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw bounding boxes and labels
      if (filteredPredictions.length > 0) {
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = 3;
        ctx.font = '16px Arial';
        ctx.fillStyle = highlightColor;

        filteredPredictions.forEach(prediction => {
          const [x, y, width, height] = prediction.bbox;
          
          // Draw bounding box
          ctx.strokeRect(x, y, width, height);
          
          if (showLabels) {
            // Draw label background
            const label = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
            const textMetrics = ctx.measureText(label);
            const textWidth = textMetrics.width;
            const textHeight = 20;
            
            ctx.fillStyle = highlightColor;
            ctx.fillRect(x, y - textHeight - 4, textWidth + 8, textHeight + 4);
            
            // Draw label text
            ctx.fillStyle = 'white';
            ctx.fillText(label, x + 4, y - 8);
          }
        });
      }

      // Calculate FPS
      const now = performance.now();
      if (lastFrameTime) {
        const delta = now - lastFrameTime;
        const currentFps = 1000 / delta;
        setFps(Math.round(currentFps));
      }
      setLastFrameTime(now);
      setFrameCount(prev => prev + 1);

    } catch (error) {
      console.error('Error during object detection:', error);
    }

    // Continue detection loop
    if (isActive) {
      animationFrameRef.current = requestAnimationFrame(detectObjects);
    }
  }, [videoRef, isActive, confidence, highlightColor, showLabels, onDetection, lastFrameTime]);

  // Start/stop detection
  useEffect(() => {
    if (isActive && isModelReady) {
      detectObjects();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, isModelReady, detectObjects]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleToggle = () => {
    if (!isModelReady && !isModelLoading) {
      loadModel();
    }
    onToggle();
  };

  return (
    <div className="relative">
      {/* Detection Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none z-10"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
      
      {/* Control Panel */}
      <Card className="absolute top-4 right-4 p-3 bg-black/20 backdrop-blur-sm border-white/20 z-20">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isActive ? "default" : "outline"}
              onClick={handleToggle}
              disabled={isModelLoading}
              className="flex items-center gap-2"
            >
              {isModelLoading ? (
                <Zap className="w-4 h-4 animate-spin" />
              ) : isActive ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              {isModelLoading ? 'Loading...' : isActive ? 'Detection On' : 'Detection Off'}
            </Button>
          </div>
          
          {/* Stats */}
          {isModelReady && (
            <div className="flex flex-wrap gap-1 text-xs">
              <Badge variant="secondary" className="bg-black/40 text-white">
                <Target className="w-3 h-3 mr-1" />
                {detections.length} objects
              </Badge>
              <Badge variant="secondary" className="bg-black/40 text-white">
                {fps} FPS
              </Badge>
            </div>
          )}
          
          {/* Detected Objects List */}
          {isActive && detections.length > 0 && (
            <div className="max-w-40 max-h-32 overflow-y-auto space-y-1">
              {detections.map((detection, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs bg-black/40 text-white border-white/20 block w-full"
                >
                  {detection.class} ({Math.round(detection.score * 100)}%)
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};