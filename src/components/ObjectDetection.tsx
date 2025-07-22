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

export interface DetectionSettings {
  enablePeople: boolean;
  enableVehicles: boolean;
  enableAnimals: boolean;
  enableObjects: boolean;
  enableElectronics: boolean;
  showLabels: boolean;
  showConfidence: boolean;
  minConfidence: number;
}

interface ObjectDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  onToggle: () => void;
  settings?: DetectionSettings;
  onDetection?: (detections: Detection[]) => void;
  onSettingsChange?: (settings: DetectionSettings) => void;
}

// Object category definitions with colors
const OBJECT_CATEGORIES = {
  people: {
    color: '#FF6B6B', // Red
    objects: ['person', 'face']
  },
  vehicles: {
    color: '#4ECDC4', // Teal
    objects: ['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'airplane', 'train', 'boat']
  },
  animals: {
    color: '#45B7D1', // Blue
    objects: ['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe']
  },
  objects: {
    color: '#96CEB4', // Green
    objects: ['bottle', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush']
  },
  electronics: {
    color: '#FECA57', // Yellow
    objects: ['tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator']
  }
};

const DEFAULT_SETTINGS: DetectionSettings = {
  enablePeople: true,
  enableVehicles: true,
  enableAnimals: true,
  enableObjects: true,
  enableElectronics: true,
  showLabels: true,
  showConfidence: true,
  minConfidence: 0.5
};

export const ObjectDetection: React.FC<ObjectDetectionProps> = ({
  videoRef,
  isActive,
  onToggle,
  settings = DEFAULT_SETTINGS,
  onDetection,
  onSettingsChange
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
  const [showSettings, setShowSettings] = useState(false);

  // Get category and color for an object
  const getObjectInfo = (className: string) => {
    for (const [category, info] of Object.entries(OBJECT_CATEGORIES)) {
      if (info.objects.includes(className)) {
        return { category, color: info.color };
      }
    }
    return { category: 'objects', color: OBJECT_CATEGORIES.objects.color };
  };

  // Check if object should be detected based on settings
  const shouldDetectObject = (className: string) => {
    const { category } = getObjectInfo(className);
    switch (category) {
      case 'people': return settings.enablePeople;
      case 'vehicles': return settings.enableVehicles;
      case 'animals': return settings.enableAnimals;
      case 'electronics': return settings.enableElectronics;
      default: return settings.enableObjects;
    }
  };

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

    // Set canvas size to match video exactly
    const rect = video.getBoundingClientRect();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Position canvas to overlay video perfectly
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    try {
      // Run object detection
      const predictions = await modelRef.current.detect(video);
      
      // Filter predictions by confidence and enabled categories
      const filteredPredictions = predictions.filter(prediction => 
        prediction.score >= settings.minConfidence && shouldDetectObject(prediction.class)
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

      // Draw bounding boxes and labels with category colors
      if (filteredPredictions.length > 0) {
        ctx.lineWidth = 3;
        ctx.font = 'bold 16px Arial';
        ctx.textBaseline = 'top';

        filteredPredictions.forEach(prediction => {
          const [x, y, width, height] = prediction.bbox;
          const { color } = getObjectInfo(prediction.class);
          
          // Draw bounding box with category color
          ctx.strokeStyle = color;
          ctx.strokeRect(x, y, width, height);
          
          // Add subtle glow effect
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.strokeRect(x, y, width, height);
          ctx.shadowBlur = 0;
          
          if (settings.showLabels) {
            // Create label text
            let label = prediction.class.charAt(0).toUpperCase() + prediction.class.slice(1);
            if (settings.showConfidence) {
              label += ` ${Math.round(prediction.score * 100)}%`;
            }
            
            // Measure text for background
            ctx.font = 'bold 14px Arial';
            const textMetrics = ctx.measureText(label);
            const textWidth = textMetrics.width;
            const textHeight = 18;
            const padding = 6;
            
            // Draw label background with category color
            ctx.fillStyle = color;
            ctx.fillRect(x, y - textHeight - padding, textWidth + padding * 2, textHeight + padding);
            
            // Draw label text
            ctx.fillStyle = 'white';
            ctx.fillText(label, x + padding, y - textHeight);
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
  }, [videoRef, isActive, settings, onDetection, lastFrameTime, shouldDetectObject, getObjectInfo]);

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
    <div className="relative w-full h-full">
      {/* Detection Canvas Overlay - positioned to perfectly overlay video */}
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
              {isModelLoading ? 'Loading...' : isActive ? 'On' : 'Off'}
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1 text-white hover:bg-white/20"
            >
              <Settings className="w-4 h-4" />
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
          
          {/* Category Legend */}
          <div className="flex flex-wrap gap-1 text-xs">
            {Object.entries(OBJECT_CATEGORIES).map(([category, info]) => (
              <Badge 
                key={category} 
                variant="outline" 
                className="text-white border-white/20"
                style={{ backgroundColor: `${info.color}40`, borderColor: info.color }}
              >
                {category}
              </Badge>
            ))}
          </div>
          
          {/* Detected Objects List with Colors */}
          {isActive && detections.length > 0 && (
            <div className="max-w-48 max-h-32 overflow-y-auto space-y-1">
              {detections.map((detection, index) => {
                const { color } = getObjectInfo(detection.class);
                return (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-xs text-white border-white/20 block w-full"
                    style={{ backgroundColor: `${color}60`, borderColor: color }}
                  >
                    {detection.class.charAt(0).toUpperCase() + detection.class.slice(1)} ({Math.round(detection.score * 100)}%)
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Settings Panel */}
      {showSettings && (
        <Card className="absolute top-4 left-4 p-4 bg-black/20 backdrop-blur-sm border-white/20 z-20 min-w-64">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Detection Settings
          </h3>
          
          <div className="space-y-3">
            {/* Category Toggles */}
            <div className="space-y-2">
              <label className="text-xs text-white/80">Categories to Detect:</label>
              {Object.entries(OBJECT_CATEGORIES).map(([category, info]) => (
                <div key={category} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={category}
                    checked={settings[`enable${category.charAt(0).toUpperCase() + category.slice(1)}` as keyof DetectionSettings] as boolean}
                    onChange={(e) => {
                      const key = `enable${category.charAt(0).toUpperCase() + category.slice(1)}` as keyof DetectionSettings;
                      onSettingsChange?.({
                        ...settings,
                        [key]: e.target.checked
                      });
                    }}
                    className="rounded"
                  />
                  <label 
                    htmlFor={category} 
                    className="text-sm text-white cursor-pointer flex items-center gap-2"
                  >
                    <div 
                      className="w-3 h-3 rounded" 
                      style={{ backgroundColor: info.color }}
                    />
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </label>
                </div>
              ))}
            </div>
            
            {/* Display Options */}
            <div className="space-y-2 pt-2 border-t border-white/20">
              <label className="text-xs text-white/80">Display Options:</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showLabels"
                  checked={settings.showLabels}
                  onChange={(e) => onSettingsChange?.({...settings, showLabels: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="showLabels" className="text-sm text-white cursor-pointer">
                  Show Labels
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showConfidence"
                  checked={settings.showConfidence}
                  onChange={(e) => onSettingsChange?.({...settings, showConfidence: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="showConfidence" className="text-sm text-white cursor-pointer">
                  Show Confidence %
                </label>
              </div>
            </div>
            
            {/* Confidence Threshold */}
            <div className="space-y-2 pt-2 border-t border-white/20">
              <label className="text-xs text-white/80">
                Min Confidence: {Math.round(settings.minConfidence * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.1"
                value={settings.minConfidence}
                onChange={(e) => onSettingsChange?.({...settings, minConfidence: parseFloat(e.target.value)})}
                className="w-full"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};