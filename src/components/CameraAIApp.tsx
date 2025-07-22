import React, { useState, useRef, useEffect } from 'react';
import { Camera, CameraOff, Circle, Sparkles, Home, Settings, LogIn, LogOut, User, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { SettingsModal } from './SettingsModal';
import { CameraPreview } from './CameraPreview';
import { AutoCaptureProgress } from './AutoCaptureProgress';
import { ImageGallery } from './ImageGallery';
import { useAutoCapture } from '@/hooks/useAutoCapture';

// Using Puter.com API loaded from CDN
declare const puter: any;

interface CapturedImage {
  dataUrl: string;
  timestamp: Date;
  description?: string;
}

interface User {
  username: string;
  fullName?: string;
}

interface Settings {
  theme: 'light' | 'dark';
  streaming: boolean;
  autoCapture: boolean;
  captureTime: number;
  captureAmount: number;
  captureQuality: 'high' | 'medium' | 'low';
  completeAlert: boolean;
  tooltips: boolean;
  realTimeDetection: boolean;
  detectionClasses: string[];
}

const CameraAIApp: React.FC = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Camera state
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Capture state
  const [lastCapture, setLastCapture] = useState<CapturedImage | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isDescribing, setIsDescribing] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [showFlash, setShowFlash] = useState(false);
  const [aiQueue, setAiQueue] = useState<CapturedImage[]>([]);
  const [processingAI, setProcessingAI] = useState(false);
  const [latestDetections, setLatestDetections] = useState<{ class: string; score: number; bbox: number[] }[]>([]);

  // Settings state
  const [settings, setSettings] = useState<Settings>({
    theme: 'dark',
    streaming: true,
    autoCapture: false,
    captureTime: 5,
    captureAmount: 5,
    captureQuality: 'high',
    completeAlert: true,
    tooltips: true,
    realTimeDetection: false,
    detectionClasses: []
  });

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Define captureImage function before using it in useAutoCapture
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraOn) {
      toast({
        title: "Camera not ready",
        description: "Please ensure camera is on",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!videoLoaded || video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Video not ready - loaded:', videoLoaded, 'dimensions:', video.videoWidth, 'x', video.videoHeight);
      toast({
        title: "Video not ready",
        description: "Please wait for camera to fully load",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    setIsCapturing(true);
    setShowFlash(true);

    try {
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      console.log('Capturing image with dimensions:', canvas.width, 'x', canvas.height);
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const quality = settings.captureQuality === 'high' ? 0.9 : 
                     settings.captureQuality === 'medium' ? 0.7 : 0.5;
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      
      const newCapture: CapturedImage = {
        dataUrl,
        timestamp: new Date()
      };
      
      setLastCapture(newCapture);
      setCapturedImages(prev => [newCapture, ...prev]);
      setAiDescription('');
      
      // Only add to AI processing queue if auto-capture is enabled and authenticated
      if (settings.autoCapture && isAuthenticated) {
        setAiQueue(prev => [...prev, newCapture]);
      }
      
      console.log('Image captured successfully, size:', dataUrl.length, 'bytes');
      
      toast({
        title: "Image Captured",
        description: "Screenshot saved successfully",
        duration: 3000
      });
    } catch (error) {
      console.error('Capture error:', error);
      toast({
        title: "Capture failed",
        description: "Unable to capture image from video",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setTimeout(() => {
        setShowFlash(false);
        setIsCapturing(false);
      }, 300);
    }
  };

  // Auto-capture hook
  const autoCapture = useAutoCapture(
    {
      enabled: settings.autoCapture,
      captureTime: settings.captureTime,
      captureAmount: settings.captureAmount,
      captureQuality: settings.captureQuality
    },
    captureImage,
    isCameraOn && videoLoaded && !isCapturing
  );

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    checkAvailableCameras();
    checkAuthStatus();
  }, []);

  // Process AI queue
  useEffect(() => {
    if (aiQueue.length > 0 && !processingAI) {
      processNextAIRequest();
    }
  }, [aiQueue, processingAI]);

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('aiCameraSettings');
      if (saved) {
        const savedSettings = JSON.parse(saved);
        setSettings(savedSettings);
        applyTheme(savedSettings.theme);
      } else {
        // Apply default theme on first load
        applyTheme(settings.theme);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      applyTheme(settings.theme);
    }
  };

  const applyTheme = (theme: 'light' | 'dark') => {
    const htmlElement = document.documentElement;
    
    // Remove existing theme classes
    htmlElement.classList.remove('light', 'dark');
    
    // Add new theme class
    htmlElement.classList.add(theme);
    
    console.log('Theme applied:', theme, 'Current classes:', htmlElement.classList.toString());
  };

  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
    applyTheme(newSettings.theme);
    
    // Save settings to localStorage
    try {
      localStorage.setItem('aiCameraSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const processNextAIRequest = async () => {
    if (aiQueue.length === 0 || processingAI) return;
    
    setProcessingAI(true);
    const imageToProcess = aiQueue[0];
    
    try {
      console.log('Sending image to AI for description, size:', imageToProcess.dataUrl.length);
      
      // Enhanced prompt for better descriptions
      const enhancedPrompt = `Analyze this image in detail. Please provide a comprehensive description that includes:
      
      1. Overall scene description
      2. Time of day (if determinable from lighting/context)
      3. Objects, people, animals, or items visible
      4. Colors, textures, and composition
      5. Any readable text or signs
      6. If people are visible, describe general appearance (clothing, activities, etc.)
      7. Setting/environment details
      8. Any notable features or points of interest
      
      Format the response with clear paragraphs and proper structure for readability.`;
      
      const response = await puter.ai.chat(enhancedPrompt, imageToProcess.dataUrl);
      
      // Handle the response as a string
      const description = typeof response === 'string' ? response : String(response);
      
      console.log('AI description received:', description.substring(0, 100) + '...');
      
      // Update the image with description
      setCapturedImages(prev => 
        prev.map(img => 
          img.timestamp === imageToProcess.timestamp 
            ? { ...img, description }
            : img
        )
      );
      
      if (lastCapture && lastCapture.timestamp === imageToProcess.timestamp) {
        setLastCapture(prev => prev ? { ...prev, description } : null);
        setAiDescription(description);
      }
      
      toast({
        title: "Image described successfully",
        description: "AI analysis complete",
        duration: 3000
      });
    } catch (error) {
      console.error('AI description error:', error);
      toast({
        title: "AI description failed",
        description: "Please try again",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      // Remove processed image from queue
      setAiQueue(prev => prev.slice(1));
      setProcessingAI(false);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const isSignedIn = await puter.auth.isSignedIn();
      if (isSignedIn) {
        const userInfo = await puter.auth.getUser();
        setIsAuthenticated(true);
        setUser({
          username: userInfo.username,
          fullName: userInfo.fullName
        });
      }
    } catch (error) {
      console.log('Not signed in or error checking auth status:', error);
    }
  };

  const checkAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      console.log('Available cameras:', cameras.length);
    } catch (error) {
      console.error('Error enumerating cameras:', error);
    }
  };

  const handleSignIn = async () => {
    try {
      const result = await puter.auth.signIn();
      setIsAuthenticated(true);
      setUser({
        username: result.username,
        fullName: result.fullName
      });
      toast({
        title: "Signed in successfully",
        description: `Welcome, ${result.username}!`,
        duration: 3000
      });
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: "Sign in failed",
        description: "Please try again",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await puter.auth.signOut();
      setIsAuthenticated(false);
      setUser(null);
      toast({
        title: "Signed out successfully",
        duration: 3000
      });
    } catch (error) {
      console.error('Sign out error:', error);
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const requestCameraPermission = async () => {
    setIsCameraLoading(true);
    setVideoLoaded(false);
    
    try {
      console.log('Requesting camera permission with facing mode:', facingMode);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      console.log('Camera stream obtained:', mediaStream.getTracks());
      
      setStream(mediaStream);
      setIsCameraOn(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        const video = videoRef.current;
        
        const handleLoadedMetadata = () => {
          console.log('Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
          setVideoLoaded(true);
          video.play().catch(error => {
            console.error('Error playing video:', error);
            toast({
              title: "Video playback error",
              description: "Unable to start video preview",
              variant: "destructive",
              duration: 3000
            });
          });
        };

        const handleLoadedData = () => {
          console.log('Video data loaded, ready state:', video.readyState);
          setIsCameraLoading(false);
        };

        const handleError = (error: Event) => {
          console.error('Video element error:', error);
          setIsCameraLoading(false);
          toast({
            title: "Video error",
            description: "Problem with video stream",
            variant: "destructive",
            duration: 3000
          });
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('error', handleError);
        
        return () => {
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('loadeddata', handleLoadedData);
          video.removeEventListener('error', handleError);
        };
      }
      
      toast({
        title: "Camera access granted",
        description: "You can now capture images",
        duration: 3000
      });
    } catch (error) {
      console.error('Camera permission error:', error);
      setIsCameraLoading(false);
      setIsCameraOn(false);
      
      let errorMessage = "Camera access denied";
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Camera permission denied. Please allow camera access and try again.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No camera found. Please connect a camera and try again.";
        } else if (error.name === 'NotReadableError') {
          errorMessage = "Camera is being used by another application.";
        }
      }
      
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera');
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      setStream(null);
    }
    setIsCameraOn(false);
    setIsCameraLoading(false);
    setVideoLoaded(false);
    setIsMinimized(false);
    autoCapture.stopAutoCapture();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const flipCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    console.log('Flipping camera from', facingMode, 'to', newFacingMode);
    setFacingMode(newFacingMode);
    if (isCameraOn) {
      stopCamera();
      setTimeout(() => {
        requestCameraPermission();
      }, 500);
    }
  };

  const describeImage = async () => {
    if (!lastCapture) {
      toast({
        title: "No image to describe",
        description: "Please capture an image first",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use AI description",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    // Add to queue for processing (for manual mode)
    if (!aiQueue.find(img => img.timestamp === lastCapture.timestamp)) {
      setAiQueue(prev => [lastCapture, ...prev]);
    }
  };

  const handleAutoCaptureToggle = () => {
    if (autoCapture.isActive) {
      autoCapture.stopAutoCapture();
    } else {
      autoCapture.startAutoCapture();
    }
  };

  const getCaptureButtonText = () => {
    if (settings.autoCapture) {
      if (autoCapture.isActive) {
        return `Auto-Capture (${autoCapture.currentCount}/${settings.captureAmount})`;
      }
      return 'Auto-Capture';
    }
    return isCapturing ? 'Capturing...' : 'Capture';
  };

  // Export detections as JSON
  const exportDetections = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(latestDetections, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `detections_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="min-h-screen bg-gradient-dark text-foreground">
      {/* Flash overlay */}
      {showFlash && <div className="fixed inset-0 z-50 camera-flash pointer-events-none" />}
      
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="relative">
              <Button 
                variant="outline" 
                onClick={() => setShowUserDropdown(!showUserDropdown)} 
                className="flex items-center gap-2"
                title={settings.tooltips ? `Signed in as ${user?.username}` : undefined}
              >
                <User className="h-4 w-4" />
                {user?.username}
              </Button>
              
              {showUserDropdown && (
                <div className="absolute top-full left-0 mt-2 p-2 bg-card border border-border rounded-lg shadow-modal z-50">
                  <p className="text-sm text-muted-foreground mb-2">
                    {user?.fullName || user?.username}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSignOut} 
                    className="flex items-center gap-2 w-full justify-start"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Button 
              variant="outline" 
              onClick={handleSignIn} 
              className="flex items-center gap-2"
              title={settings.tooltips ? "Sign in to use AI features" : undefined}
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSettings(true)} 
            className="border border-gray-400 rounded-lg"
            title={settings.tooltips ? "Open settings" : undefined}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-6">
        {/* Camera Preview */}
        {(isCameraOn || isCameraLoading) && (
          <CameraPreview
            videoRef={videoRef}
            isMinimized={isMinimized}
            onToggleMinimize={() => setIsMinimized(!isMinimized)}
            onFlipCamera={flipCamera}
            isCameraLoading={isCameraLoading}
            videoLoaded={videoLoaded}
            availableCameras={availableCameras}
            showFlipButton={true}
            realTimeDetection={settings.realTimeDetection}
            detectionClasses={settings.detectionClasses}
            onDetectionsUpdate={setLatestDetections}
          />
        )}
        {/* Export Detections Button */}
        {settings.realTimeDetection && latestDetections.length > 0 && (
          <div className="flex justify-end mt-2">
            <Button onClick={exportDetections} variant="outline" size="sm">
              Export Detections (JSON)
            </Button>
          </div>
        )}

        {/* Auto-Capture Progress */}
        {settings.autoCapture && isCameraOn && (
          <AutoCaptureProgress
            progress={autoCapture.progress}
            remainingTime={autoCapture.remainingTime}
            isActive={autoCapture.isActive}
          />
        )}

        {/* Camera Controls */}
        <div className="flex gap-4">
          <Button 
            onClick={isCameraOn ? stopCamera : requestCameraPermission} 
            variant={isCameraOn ? "destructive" : "default"} 
            className="flex-1 h-12"
            disabled={isCameraLoading}
            title={settings.tooltips ? (isCameraOn ? "Turn off camera" : "Turn on camera") : undefined}
          >
            {isCameraLoading ? (
              <>
                <Loader className="h-5 w-5 mr-2 animate-spin" />
                Starting Camera...
              </>
            ) : isCameraOn ? (
              <>
                <CameraOff className="h-5 w-5 mr-2" />
                Camera Off
              </>
            ) : (
              <>
                <Camera className="h-5 w-5 mr-2" />
                Camera On
              </>
            )}
          </Button>
        </div>

        {/* Capture Controls */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={settings.autoCapture ? handleAutoCaptureToggle : captureImage} 
            disabled={!isCameraOn || isCapturing || !videoLoaded || isCameraLoading} 
            className="h-12 capture-button gradient-primary"
            title={settings.tooltips ? (settings.autoCapture 
              ? (autoCapture.isActive ? "Stop auto-capture" : "Start auto-capture")
              : "Take a photo"
            ) : undefined}
          >
            <Circle className="h-5 w-5 mr-2" />
            {getCaptureButtonText()}
          </Button>
          
          <Button 
            onClick={describeImage} 
            disabled={!lastCapture || processingAI || settings.autoCapture} 
            variant="outline" 
            className="h-12"
            title={settings.tooltips ? "Get AI description of last captured image" : undefined}
          >
            {processingAI ? (
              <>
                <Loader className="h-5 w-5 mr-2 animate-spin" />
                Describing...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Describe
              </>
            )}
          </Button>
        </div>

        {/* Image Gallery */}
        {capturedImages.length > 0 && (
          <ImageGallery images={capturedImages} />
        )}

        {/* Last Capture Thumbnail (for single capture mode) */}
        {lastCapture && !settings.autoCapture && (
          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Last Capture
            </h3>
            <div className="flex gap-4">
              <img 
                src={lastCapture.dataUrl} 
                alt="Last capture" 
                className="w-20 h-20 object-cover rounded-lg border shadow-sm" 
              />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {lastCapture.timestamp.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Image captured successfully
                </p>
                {lastCapture.description && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ AI description available
                  </p>
                )}
                {aiQueue.find(img => img.timestamp === lastCapture.timestamp) && (
                  <p className="text-xs text-yellow-600 mt-1">
                    ⏳ Queued for AI description
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* AI Description (for single capture mode) */}
        {aiDescription && !settings.autoCapture && (
          <Card className="ai-response-box">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              AI Description
            </h3>
            <div className="prose prose-invert max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {aiDescription}
              </p>
            </div>
          </Card>
        )}

        {/* AI Processing Queue Status */}
        {aiQueue.length > 0 && (
          <Card className="p-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <Loader className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Processing {aiQueue.length} image{aiQueue.length > 1 ? 's' : ''} for AI description...
              </span>
            </div>
          </Card>
        )}

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground border-t border-border">
        <p>
          Created by{' '}
          <a href="https://jayreddin.github.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Jamie Reddin
          </a>{' '}
          using{' '}
          <a href="https://puter.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Puter.com
          </a>{' '}
          | Version 1.0 | 2025
        </p>
      </footer>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        isAuthenticated={isAuthenticated} 
        user={user} 
        lastCapture={lastCapture} 
        aiDescription={aiDescription}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
};

export default CameraAIApp;
