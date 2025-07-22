import React, { useState, useRef, useEffect } from 'react';
import { Camera, CameraOff, Circle, Sparkles, Home, Settings, LogIn, LogOut, User, Loader, Download, Eye, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { SettingsModal } from './SettingsModal';
import { CameraPreview } from './CameraPreview';
import { AutoCaptureProgress } from './AutoCaptureProgress';
import { ImageGallery } from './ImageGallery';
import { TTSSettingsProvider } from '@/contexts/TTSSettingsContext';
import { TTSControls } from './TTSControls';
import { useAutoCapture } from '@/hooks/useAutoCapture';
import jsPDF from 'jspdf';
import { ErrorBoundary } from './ErrorBoundary';
import { handleCameraError, handleConfigurationError, errorHandler } from '@/lib/errorHandling';
import { LoadingIndicator, useLoadingOverlay } from './LoadingIndicator';
import { cameraManager, configManager } from '@/lib/fallbacks';
import { ObjectDetection, DetectionSettings } from './ObjectDetection';
import { usePushNotifications } from '@/services/pushNotifications';

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

interface TTSVoice {
  language: string;
  name: string;
  engine: 'standard' | 'neural' | 'generative';
  displayName: string;
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
  previewMinWidth: number;
  previewMinHeight: number;
  maintainAspectRatio: boolean;
  captureImageName: string;
  pdfHeaderColor: string;
  pdfTextColor: string;
  pdfBorderColor: string;
  pdfGradientColor: string;
  pdfIncludeTimestamp: boolean;
  pdfIncludeUserInfo: boolean;
  pdfCustomUserInfo: string;
  pdfIncludeEmojis: boolean;
  pdfImageSize: 'small' | 'medium' | 'large';
  pdfPageOrientation: 'portrait' | 'landscape';
  pdfDescriptionBorder: boolean;
  pdfTextSizePercent: number;
  pdfHeaderPadding: number;
  pdfImagePadding: number;
  pdfTextPadding: number;
  pdfHeaderMargin: number;
  pdfImageMargin: number;
  pdfTextMargin: number;
  customAiPrompt: string;
  aiPersonAnalysis: boolean;
  aiPersonGender: boolean;
  aiPersonAge: boolean;
  aiPersonMood: boolean;
  aiSceneryAnalysis: boolean;
  aiSceneryTime: boolean;
  aiSceneryWeather: boolean;
  aiSceneryLocation: boolean;
  aiObjectAnalysis: boolean;
  aiObjectName: boolean;
  aiObjectSize: boolean;
  aiObjectText: boolean;
  aiObjectUses: boolean;
  aiObjectFacts: boolean;
  aiRandomAnalysis: boolean;
  aiRandomColors: boolean;
  aiRandomLocation: boolean;
  aiRandomPeopleCount: boolean;
  aiRandomVehicles: boolean;
  ttsEngine: 'standard' | 'neural' | 'generative';
  ttsVoice: TTSVoice;
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
  const [isFlipping, setIsFlipping] = useState(false);

  // Capture state
  const [lastCapture, setLastCapture] = useState<CapturedImage | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isDescribing, setIsDescribing] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [showFlash, setShowFlash] = useState(false);
  const [aiQueue, setAiQueue] = useState<CapturedImage[]>([]);
  const [processingAI, setProcessingAI] = useState(false);

  // Object Detection state
  const [isObjectDetectionOn, setIsObjectDetectionOn] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [detectionSettings, setDetectionSettings] = useState<DetectionSettings>({
    enablePeople: true,
    enableVehicles: true,
    enableAnimals: true,
    enableObjects: true,
    enableElectronics: true,
    showLabels: true,
    showConfidence: true,
    minConfidence: 0.5
  });

  // Handle object detection results
  const handleObjectDetection = (detections: Array<{bbox: number[], class: string, score: number}>) => {
    const objects = detections.map(d => d.class);
    setDetectedObjects(objects);
    
    // Notify of new objects if significant detection
    if (detections.length > 0 && detections[0].score > 0.8) {
      pushNotifications.notifyObjectDetected(objects, detections[0].score);
    }
  };

  const toggleObjectDetection = () => {
    setIsObjectDetectionOn(!isObjectDetectionOn);
  };

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
    previewMinWidth: 400,
    previewMinHeight: 225,
    maintainAspectRatio: true,
    captureImageName: 'Capture',
    pdfHeaderColor: '#3B82F6',
    pdfTextColor: '#1F2937',
    pdfBorderColor: '#E5E7EB',
    pdfGradientColor: '#F3F4F6',
    pdfIncludeTimestamp: true,
    pdfIncludeUserInfo: true,
    pdfCustomUserInfo: '',
    pdfIncludeEmojis: true,
    pdfImageSize: 'medium',
    pdfPageOrientation: 'portrait',
    pdfDescriptionBorder: false,
    pdfTextSizePercent: 100,
    pdfHeaderPadding: 10,
    pdfImagePadding: 5,
    pdfTextPadding: 8,
    pdfHeaderMargin: 15,
    pdfImageMargin: 10,
    pdfTextMargin: 12,
    customAiPrompt: 'Analyze this image in detail and provide a comprehensive description.',
    aiPersonAnalysis: false,
    aiPersonGender: false,
    aiPersonAge: false,
    aiPersonMood: false,
    aiSceneryAnalysis: false,
    aiSceneryTime: false,
    aiSceneryWeather: false,
    aiSceneryLocation: false,
    aiObjectAnalysis: false,
    aiObjectName: false,
    aiObjectSize: false,
    aiObjectText: false,
    aiObjectUses: false,
    aiObjectFacts: false,
    aiRandomAnalysis: false,
    aiRandomColors: false,
    aiRandomLocation: false,
    aiRandomPeopleCount: false,
    aiRandomVehicles: false,
    ttsEngine: 'neural',
    ttsVoice: {
      language: 'en-US',
      name: 'Joanna',
      engine: 'neural',
      displayName: 'Joanna (US, Neural)'
    }
  });

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(true);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Push notifications and PWA
  const pushNotifications = usePushNotifications();
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);

  // Initialize push notifications
  useEffect(() => {
    if (pushNotifications.isSupported) {
      pushNotifications.initialize().then(initialized => {
        if (initialized) {
          console.log('Push notifications initialized');
        }
      });
    }
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setShowPWAPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Fallback TTS function for when configured TTS fails
  const fallbackTTS = async (text: string) => {
    try {
      console.log('Using fallback TTS with standard engine');
      return await puter.ai.txt2speech(text);
    } catch (error) {
      console.error('Fallback TTS also failed:', error);
      
      // Provide specific error message based on error type
      let errorMessage = 'All TTS options failed';
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        if (errorStr.includes('insufficient') || errorStr.includes('funds') || errorStr.includes('quota')) {
          errorMessage = 'TTS quota exceeded. Please try again later.';
        } else if (errorStr.includes('network') || errorStr.includes('connection')) {
          errorMessage = 'Network error - check your connection and try again.';
        } else if (errorStr.includes('auth') || errorStr.includes('permission')) {
          errorMessage = 'Authentication required for TTS service.';
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  // Markdown formatting function for AI descriptions
  const formatMarkdown = (text: string) => {
    if (!text) return '';
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-4 mb-2 text-blue-600 dark:text-blue-400">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-4 mb-2 text-blue-700 dark:text-blue-300">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-4 mb-3 text-blue-800 dark:text-blue-200">$1</h1>')
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>')
      .replace(/__(.*?)__/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>')
      // Italic text
      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700 dark:text-gray-300">$1</em>')
      .replace(/_(.*?)_/g, '<em class="italic text-gray-700 dark:text-gray-300">$1</em>')
      // Lists
      .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc mb-1">$1</li>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc mb-1">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal mb-1">$1</li>')
      // Code blocks
      .replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono text-red-600 dark:text-red-400">$1</code>')
      // Line breaks and paragraphs
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, '<br>')
      // Wrap in paragraph tags
      .replace(/^(.*)$/gm, '<p class="mb-3 leading-relaxed">$1</p>')
      // Clean up empty paragraphs
      .replace(/<p class="mb-3 leading-relaxed"><\/p>/g, '')
      // Wrap lists properly
      .replace(/(<li class="ml-4 list-[^"]+">.*?<\/li>)/gs, '<ul class="mb-3 space-y-1">$1</ul>');
  };

  // Markdown formatting for PDF (plain text with enhanced formatting)
  const formatMarkdownForPDF = (text: string) => {
    if (!text) return '';
    return text
      // Convert headers to uppercase with spacing
      .replace(/^### (.*$)/gim, '\n\n$1\n' + '─'.repeat(20))
      .replace(/^## (.*$)/gim, '\n\n$1\n' + '═'.repeat(25))
      .replace(/^# (.*$)/gim, '\n\n$1\n' + '█'.repeat(30))
      // Convert bold to uppercase
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      // Remove italic markers but keep text
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // Convert lists to proper indentation
      .replace(/^- (.*$)/gim, '  • $1')
      .replace(/^\* (.*$)/gim, '  • $1')
      .replace(/^\d+\. (.*$)/gim, '  $&')
      // Remove code block markers
      .replace(/`([^`]+)`/g, '$1')
      // Clean up extra line breaks
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

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

  // Auto-capture hook with completion notification
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

  // Watch for auto capture completion
  useEffect(() => {
    if (autoCapture.isActive === false && autoCapture.currentCount === 0 && 
        capturedImages.length > 0 && settings.autoCapture) {
      // Auto capture just completed
      pushNotifications.notifyBatchComplete(1, settings.captureAmount);
    }
  }, [autoCapture.isActive, autoCapture.currentCount, capturedImages.length, settings.autoCapture]);

  // Load settings on mount with proper cleanup
  useEffect(() => {
    loadSettings();
    checkAvailableCameras();
    checkAuthStatus();
    checkSecureContext();

    // Cleanup function for any global event listeners or resources
    return () => {
      // Clean up any global resources if needed
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const checkSecureContext = () => {
    // Check if we're in a secure context (HTTPS or localhost)
    const isSecure = window.isSecureContext || 
                    location.protocol === 'https:' || 
                    location.hostname === 'localhost' || 
                    location.hostname === '127.0.0.1';
    setIsSecureContext(isSecure);
  };

  // Process AI queue
  useEffect(() => {
    if (aiQueue.length > 0 && !processingAI) {
      processNextAIRequest();
    }
  }, [aiQueue, processingAI]);

  const loadSettings = () => {
    try {
      const defaultSettings = settings;
      const loadedSettings = configManager.loadConfigWithFallback('aiCameraSettings', defaultSettings);
      setSettings(loadedSettings);
      applyTheme(loadedSettings.theme);
    } catch (error) {
      handleConfigurationError(error as Error, {
        component: 'CameraAIApp',
        action: 'load_settings'
      });
      applyTheme(settings.theme);
    }
  };

  const updateFavicon = (theme: 'light' | 'dark') => {
    const favicon = document.getElementById('favicon') as HTMLLinkElement;
    if (favicon) {
      // Light mode uses dark icon, dark mode uses white icon
      favicon.href = theme === 'light' ? '/fav-dark.ico' : '/fav-white.ico';
    }
  };

  const applyTheme = (theme: 'light' | 'dark') => {
    const htmlElement = document.documentElement;
    
    // Remove existing theme classes
    htmlElement.classList.remove('light', 'dark');
    
    // Add new theme class
    htmlElement.classList.add(theme);
    
    // Update favicon based on theme
    updateFavicon(theme);
    
    console.log('Theme applied:', theme, 'Current classes:', htmlElement.classList.toString());
  };

  const handleSettingsChange = (newSettings: Settings) => {
    try {
      setSettings(newSettings);
      applyTheme(newSettings.theme);
      
      // Save settings with fallback handling
      const saved = configManager.saveConfigWithFallback('aiCameraSettings', newSettings);
      if (!saved) {
        // If save failed, show warning but continue with in-memory settings
        console.warn('Settings could not be persisted but will remain active for this session');
      }
    } catch (error) {
      handleConfigurationError(error as Error, {
        component: 'CameraAIApp',
        action: 'save_settings',
        additionalData: { settingsKeys: Object.keys(newSettings) }
      });
    }
  };

  const buildAIPrompt = () => {
    let prompt = settings.customAiPrompt || 'Analyze this image in detail and provide a comprehensive description.';
    
    const analysisRequests = [];
    
    if (settings.aiPersonAnalysis) {
      analysisRequests.push(`
      PERSON ANALYSIS:
      - Gender identification (if visible)
      - Approximate age range
      - Mood/emotional expression
      - Clothing and appearance details`);
    }
    
    if (settings.aiSceneryAnalysis) {
      analysisRequests.push(`
      SCENERY ANALYSIS:
      - Time of day (day/night/dawn/dusk)
      - Weather conditions (if determinable)
      - Location type (City, Rural, Beach, Mountains, River, Park, Inside, Outside, Car, Plane, Boat)
      - Environmental details and atmosphere`);
    }
    
    if (settings.aiObjectAnalysis) {
      analysisRequests.push(`
      OBJECT ANALYSIS:
      - Name and identify all visible objects
      - Estimated size/scale of objects
      - Any readable text in the image
      - Purpose/uses of identified objects
      - Interesting facts about notable objects`);
    }
    
    if (settings.aiRandomAnalysis) {
      analysisRequests.push(`
      ADDITIONAL DETAILS:
      - Dominant colors in the image
      - Rough geographic location (if determinable from context)
      - Count of visible people
      - Visible vehicles with make/model (if identifiable)
      - Any other notable or interesting details`);
    }
    
    if (analysisRequests.length > 0) {
      prompt += '\n\nPlease also include the following specific analysis:\n' + analysisRequests.join('\n');
    }
    
    prompt += '\n\nFormat the response with clear sections and proper structure for readability.';
    
    return prompt;
  };

  const processNextAIRequest = async () => {
    if (aiQueue.length === 0 || processingAI) return;
    
    setProcessingAI(true);
    const imageToProcess = aiQueue[0];
    
    try {
      console.log('Sending image to AI for description, size:', imageToProcess.dataUrl.length);
      
      const enhancedPrompt = buildAIPrompt();
      
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
      
      // Notify AI completion
      if (imageToProcess) {
        const processingTime = Date.now() - (imageToProcess.timestamp?.getTime() || Date.now());
        pushNotifications.notifyAIAnalysisComplete(1, processingTime);
      }
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
      // Check if mediaDevices is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn('MediaDevices API not available - requires HTTPS or localhost');
        setAvailableCameras([]);
        return;
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      console.log('Available cameras:', cameras.length);
    } catch (error) {
      console.error('Error enumerating cameras:', error);
      setAvailableCameras([]);
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
      // Check if mediaDevices is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access requires HTTPS or localhost. Please access the app via HTTPS or localhost.');
      }
      
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
    if (isFlipping || isCameraLoading) return;
    
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    console.log('Flipping camera from', facingMode, 'to', newFacingMode);
    
    setIsFlipping(true);
    
    if (isCameraOn) {
      try {
        // Provide immediate visual feedback
        toast({
          title: "Switching camera",
          description: `Switching to ${newFacingMode === 'user' ? 'front' : 'back'} camera...`,
          duration: 2000
        });

        // Stop current camera
        stopCamera();
        
        // Update facing mode
        setFacingMode(newFacingMode);
        
        // Wait for animation to complete, then start new camera
        // Increased timeout to match enhanced animation duration
        setTimeout(async () => {
          try {
            await requestCameraPermission();
            
            // Success feedback
            toast({
              title: "Camera switched",
              description: `Now using ${newFacingMode === 'user' ? 'front' : 'back'} camera`,
              duration: 2000
            });
          } catch (error) {
            console.error('Error restarting camera after flip:', error);
            toast({
              title: "Camera restart failed",
              description: "Unable to restart camera after switching",
              variant: "destructive",
              duration: 3000
            });
          } finally {
            setIsFlipping(false);
          }
        }, 800); // Match animation duration
        
      } catch (error) {
        console.error('Error during camera flip:', error);
        setIsFlipping(false);
        toast({
          title: "Camera flip failed",
          description: "Unable to switch camera",
          variant: "destructive",
          duration: 3000
        });
      }
    } else {
      // If camera is off, just update the facing mode
      setFacingMode(newFacingMode);
      setIsFlipping(false);
      
      toast({
        title: "Camera mode updated",
        description: `Will use ${newFacingMode === 'user' ? 'front' : 'back'} camera when started`,
        duration: 2000
      });
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

  const exportCapture = async (image: CapturedImage, description: string) => {
    try {
      await createModernPDF([{ image, description }], false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Unable to export PDF",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const exportMultipleCaptures = async (images: { image: CapturedImage, description: string }[]) => {
    try {
      await createModernPDF(images, true);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Unable to export multiple captures",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const deleteImages = (imagesToDelete: CapturedImage[]) => {
    const timestampsToDelete = new Set(imagesToDelete.map(img => img.timestamp.getTime()));
    
    // Remove from captured images
    setCapturedImages(prev => prev.filter(img => !timestampsToDelete.has(img.timestamp.getTime())));
    
    // Remove from AI queue if present
    setAiQueue(prev => prev.filter(img => !timestampsToDelete.has(img.timestamp.getTime())));
    
    // Clear last capture if it's being deleted
    if (lastCapture && timestampsToDelete.has(lastCapture.timestamp.getTime())) {
      setLastCapture(null);
      setAiDescription('');
    }
    
    toast({
      title: "Images deleted",
      description: `${imagesToDelete.length} image${imagesToDelete.length > 1 ? 's' : ''} deleted successfully`,
      duration: 3000
    });
  };

  const createModernPDF = async (captures: { image: CapturedImage, description: string }[], isMultiple: boolean) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // Modern color scheme
    const primaryColor = [59, 130, 246]; // Blue
    const secondaryColor = [107, 114, 128]; // Gray
    const accentColor = [16, 185, 129]; // Green
    
    // Header function
    const addHeader = (pageNum: number, totalPages: number) => {
      // Header background
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Live AI Camera Export', margin, 25);
      
      // Page number
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 30, 25);
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);
    };
    
    // Footer function
    const addFooter = () => {
      const footerY = pageHeight - 15;
      pdf.setFontSize(8);
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, footerY);
      if (user) {
        pdf.text(`User: ${user.username}`, pageWidth - margin - 50, footerY);
      }
      pdf.text('Created with Live AI Camera', pageWidth / 2 - 30, footerY);
    };
    
    let currentPage = 1;
    const totalPages = captures.length + (isMultiple ? 1 : 0); // +1 for summary page if multiple
    
    // Add summary page for multiple captures
    if (isMultiple) {
      addHeader(currentPage, totalPages);
      
      let yPos = 60;
      
      // Summary title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text('Export Summary', margin, yPos);
      yPos += 20;
      
      // Summary info
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Total Captures: ${captures.length}`, margin, yPos);
      yPos += 10;
      pdf.text(`Export Date: ${new Date().toLocaleDateString()}`, margin, yPos);
      yPos += 10;
      pdf.text(`Export Time: ${new Date().toLocaleTimeString()}`, margin, yPos);
      yPos += 30;
      
      // Capture list
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Captures in this Export:', margin, yPos);
      yPos += 15;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      captures.forEach((capture, index) => {
        if (yPos > pageHeight - 50) {
          pdf.addPage();
          currentPage++;
          addHeader(currentPage, totalPages);
          yPos = 60;
        }
        
        pdf.text(`${index + 1}. Captured: ${capture.image.timestamp.toLocaleString()}`, margin + 10, yPos);
        yPos += 8;
        if (capture.description) {
          const shortDesc = capture.description.substring(0, 80) + (capture.description.length > 80 ? '...' : '');
          pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          pdf.text(`   ${shortDesc}`, margin + 15, yPos);
          pdf.setTextColor(0, 0, 0);
          yPos += 12;
        }
      });
      
      addFooter();
      
      if (captures.length > 0) {
        pdf.addPage();
        currentPage++;
      }
    }
    
    // Add individual capture pages
    captures.forEach((capture, index) => {
      if (index > 0) {
        pdf.addPage();
        currentPage++;
      }
      
      addHeader(currentPage, totalPages);
      
      let yPos = 60;
      
      // Capture title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text(`Capture ${index + 1}${isMultiple ? ` of ${captures.length}` : ''}`, margin, yPos);
      yPos += 20;
      
      // Timestamp with accent color
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.text(`📅 ${capture.image.timestamp.toLocaleString()}`, margin, yPos);
      yPos += 20;
      
      // Image section
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('📸 Captured Image', margin, yPos);
      yPos += 15;
      
      // Calculate image dimensions to fit properly
      const maxImgWidth = contentWidth * 0.8;
      const maxImgHeight = 120;
      
      try {
        pdf.addImage(capture.image.dataUrl, 'JPEG', margin, yPos, maxImgWidth, maxImgHeight);
        yPos += maxImgHeight + 20;
      } catch (imgError) {
        console.error('Error adding image to PDF:', imgError);
        pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        pdf.text('Image could not be embedded', margin, yPos);
        yPos += 20;
      }
      
      // AI Description section
      if (capture.description) {
        // Check if we need a new page for description
        if (yPos > pageHeight - 100) {
          pdf.addPage();
          currentPage++;
          addHeader(currentPage, totalPages);
          yPos = 60;
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('🤖 AI Description', margin, yPos);
        yPos += 15;
        
        // Format and add description with proper page breaks
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(40, 40, 40);
        
        // Apply markdown formatting for PDF
        const formattedDescription = formatMarkdownForPDF(capture.description);
        const lines = pdf.splitTextToSize(formattedDescription, contentWidth);
        
        for (let i = 0; i < lines.length; i++) {
          if (yPos > pageHeight - 40) {
            addFooter();
            pdf.addPage();
            currentPage++;
            addHeader(currentPage, totalPages);
            yPos = 60;
          }
          
          pdf.text(lines[i], margin, yPos);
          yPos += 6;
        }
      }
      
      addFooter();
    });
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const username = user?.username || 'user';
    const filename = isMultiple 
      ? `LiveAI-Multi-${captures.length}captures-${timestamp}-${username}.pdf`
      : `LiveAI-${timestamp}-${username}.pdf`;
    
    // Download PDF
    pdf.save(filename);
    
    toast({
      title: "PDF exported successfully",
      description: `Downloaded as ${filename}`,
      duration: 3000
    });
  };

  return (
    <TTSSettingsProvider ttsConfig={{ engine: settings.ttsEngine, voice: settings.ttsVoice }}>
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
          {/* PWA Install Button */}
          {showPWAPrompt && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                pushNotifications.notifyInstallPrompt();
                setShowPWAPrompt(false);
              }}
              className="flex items-center gap-2"
              title={settings.tooltips ? "Install app for better performance" : undefined}
            >
              <Download className="h-4 w-4" />
              Install
            </Button>
          )}
          
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
        {/* Security Warning Banner */}
        {!isSecureContext && (
          <Card className="p-4 bg-yellow-500/10 border-yellow-500/20">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                <span className="text-yellow-600 text-sm">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-600 mb-2">
                  Camera Access Requires HTTPS
                </h3>
                <p className="text-xs text-yellow-600/80 leading-relaxed">
                  For security reasons, camera access is only available over HTTPS or localhost. 
                  To use the camera on your mobile device, please:
                </p>
                <ul className="text-xs text-yellow-600/80 mt-2 ml-4 space-y-1">
                  <li>• Access the app via HTTPS (secure connection)</li>
                  <li>• Or use localhost if testing locally</li>
                  <li>• Network URLs (HTTP) don't support camera access</li>
                </ul>
                <p className="text-xs text-yellow-600/80 mt-2">
                  You can still view previously captured images and use other features.
                </p>
              </div>
            </div>
          </Card>
        )}
        {/* Camera Preview with Object Detection */}
        {(isCameraOn || isCameraLoading) && (
          <div className="relative">
            <CameraPreview
              videoRef={videoRef}
              isMinimized={isMinimized}
              onToggleMinimize={() => setIsMinimized(!isMinimized)}
              onFlipCamera={flipCamera}
              isCameraLoading={isCameraLoading}
              videoLoaded={videoLoaded}
              availableCameras={availableCameras}
              showFlipButton={true}
              previewMinWidth={settings.previewMinWidth}
              previewMinHeight={settings.previewMinHeight}
              maintainAspectRatio={settings.maintainAspectRatio}
              isFlipping={isFlipping}
            />
            {/* Object Detection Overlay */}
            {videoLoaded && (
              <ObjectDetection
                videoRef={videoRef}
                isActive={isObjectDetectionOn}
                onToggle={toggleObjectDetection}
                settings={detectionSettings}
                onDetection={handleObjectDetection}
                onSettingsChange={setDetectionSettings}
              />
            )}
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

        {/* Object Detection & AI Controls */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={toggleObjectDetection}
            disabled={!isCameraOn || !videoLoaded}
            variant={isObjectDetectionOn ? "default" : "outline"}
            className="h-12"
            title={settings.tooltips ? "Toggle real-time object detection" : undefined}
          >
            {isObjectDetectionOn ? (
              <>
                <Eye className="h-5 w-5 mr-2" />
                Detection On
              </>
            ) : (
              <>
                <Target className="h-5 w-5 mr-2" />
                Detect Objects
              </>
            )}
          </Button>
          
          {detectedObjects.length > 0 && (
            <Button 
              variant="secondary" 
              className="h-12 text-sm"
              disabled
            >
              <Target className="h-4 w-4 mr-2" />
              {detectedObjects.length} object{detectedObjects.length > 1 ? 's' : ''} found
            </Button>
          )}
        </div>

        {/* Image Gallery */}
        {capturedImages.length > 0 && (
          <ImageGallery 
            images={capturedImages} 
            onExportImage={exportCapture}
            onDeleteImages={deleteImages}
            onExportMultiple={exportMultipleCaptures}
          />
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
                {/* Export Button - Show after Describe has been pressed */}
                {aiDescription && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCapture(lastCapture, aiDescription)}
                    className="mt-2 h-7 px-3 text-xs"
                    title="Export image and description as PDF"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export PDF
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* AI Description (for single capture mode) */}
        {aiDescription && !settings.autoCapture && (
          <Card className="ai-response-box">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                AI Description
              </h3>
              <TTSControls
                text={aiDescription}
                config={{
                  engine: settings.ttsEngine,
                  voice: settings.ttsVoice
                }}
                className="flex-shrink-0"
                size="sm"
                variant="ghost"
                onError={(error) => {
                  console.log('TTS failed with configured settings:', error);
                  // The TTSControls component will handle fallback internally
                  toast({
                    title: "TTS Warning",
                    description: "Using fallback TTS settings due to configuration issue",
                    duration: 3000
                  });
                }}
              />
            </div>
            <div className="prose prose-invert max-w-none">
              <div 
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: formatMarkdown(aiDescription) 
                }}
              />
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
          | Version 1.1.0 | 2025
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
    </TTSSettingsProvider>
  );
};

export default CameraAIApp;
