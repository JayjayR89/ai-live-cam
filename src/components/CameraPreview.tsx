
import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Minimize2, Maximize2, Loader } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onFlipCamera: () => void;
  isCameraLoading: boolean;
  videoLoaded: boolean;
  availableCameras: MediaDeviceInfo[];
  showFlipButton?: boolean;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  videoRef,
  isMinimized,
  onToggleMinimize,
  onFlipCamera,
  isCameraLoading,
  videoLoaded,
  availableCameras,
  showFlipButton = true
}) => {
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
