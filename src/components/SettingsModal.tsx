import React, { useState, useEffect, memo, useCallback } from 'react';
import { Download, RotateCcw, Palette, Zap, ZapOff, HelpCircle, FileDown, Image, Bot, Monitor, FileText, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  user: User | null;
  lastCapture: CapturedImage | null;
  aiDescription: string;
  onSettingsChange?: (settings: Settings) => void;
}

const AVAILABLE_VOICES: TTSVoice[] = [
  { language: 'en-IE', name: 'Niamh', engine: 'neural', displayName: 'Niamh (Irish, Neural)' },
  { language: 'en-GB', name: 'Amy', engine: 'generative', displayName: 'Amy (British, Generative)' },
  { language: 'en-GB', name: 'Brian', engine: 'standard', displayName: 'Brian (British, Standard)' },
  { language: 'en-US', name: 'Mathew', engine: 'generative', displayName: 'Mathew (US, Generative)' },
  { language: 'en-US', name: 'Joanna', engine: 'neural', displayName: 'Joanna (US, Neural)' }
];

const defaultSettings: Settings = {
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
};

const SettingsModalInner: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  lastCapture,
  aiDescription,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [tempSettings, setTempSettings] = useState<Settings>(defaultSettings);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedPreview, setExpandedPreview] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Apply theme immediately when temp settings change
  useEffect(() => {
    if (onSettingsChange) {
      // Apply theme change immediately for live preview
      const htmlElement = document.documentElement;
      htmlElement.classList.remove('light', 'dark');
      htmlElement.classList.add(tempSettings.theme);
    }
  }, [tempSettings.theme, onSettingsChange]);

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('aiCameraSettings');
      if (saved) {
        const savedSettings = JSON.parse(saved);
        // Ensure theme value is properly typed and TTS settings have defaults
        const validSettings: Settings = {
          ...defaultSettings,
          ...savedSettings,
          theme: savedSettings.theme === 'light' ? 'light' : 'dark',
          // Ensure TTS settings have proper defaults for backward compatibility
          ttsEngine: savedSettings.ttsEngine || defaultSettings.ttsEngine,
          ttsVoice: savedSettings.ttsVoice || defaultSettings.ttsVoice
        };
        setSettings(validSettings);
        setTempSettings(validSettings);
      } else {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const initialSettings: Settings = { ...defaultSettings, theme: systemTheme };
        setSettings(initialSettings);
        setTempSettings(initialSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('aiCameraSettings', JSON.stringify(tempSettings));
      setSettings(tempSettings);

      // Notify parent component of settings change
      if (onSettingsChange) {
        onSettingsChange(tempSettings);
      }

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated",
        duration: 3000
      });

      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save failed",
        description: "Unable to save settings",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const resetToDefaults = () => {
    const confirmed = window.confirm('Are you sure you want to reset all settings to defaults?');
    if (confirmed) {
      setTempSettings(defaultSettings);
      toast({
        title: "Settings reset",
        description: "All settings have been reset to defaults",
        duration: 3000
      });
    }
  };

  const cancelChanges = () => {
    setTempSettings(settings);
    // Restore original theme when canceling
    if (onSettingsChange) {
      const htmlElement = document.documentElement;
      htmlElement.classList.remove('light', 'dark');
      htmlElement.classList.add(settings.theme);
    }
    onClose();
  };

  const exportSession = async (format: 'pdf' | 'image') => {
    if (!lastCapture) {
      toast({
        title: "No content to export",
        description: "Capture an image first",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    setIsExporting(true);

    try {
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const username = user?.username || 'user';
      const filename = `AILive-${timestamp}-${username}`;

      if (format === 'pdf') {
        await exportAsPDF(filename);
      } else {
        await exportAsImage(filename);
      }

      toast({
        title: `${format.toUpperCase()} exported`,
        description: `Session exported as ${filename}.${format}`,
        duration: 3000
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Unable to export session",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPDF = async (filename: string) => {
    const pdf = new jsPDF();

    pdf.setFontSize(20);
    pdf.text('AI Camera Session', 20, 30);

    pdf.setFontSize(12);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 45);
    if (user) {
      pdf.text(`User: ${user.username}`, 20, 55);
    }

    let yPosition = 75;

    if (lastCapture) {
      pdf.text('Captured Image:', 20, yPosition);
      yPosition += 10;

      const imgData = lastCapture.dataUrl;
      const imgWidth = 150;
      const imgHeight = 100;

      pdf.addImage(imgData, 'JPEG', 20, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 20;

      pdf.text(`Captured: ${lastCapture.timestamp.toLocaleString()}`, 20, yPosition);
      yPosition += 20;
    }

    if (aiDescription) {
      pdf.text('AI Description:', 20, yPosition);
      yPosition += 10;

      const splitDescription = pdf.splitTextToSize(aiDescription, 170);
      pdf.text(splitDescription, 20, yPosition);
    }

    pdf.save(`${filename}.pdf`);
  };

  const exportAsImage = async (filename: string) => {
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'absolute';
    exportContainer.style.left = '-9999px';
    exportContainer.style.top = '0';
    exportContainer.style.width = '800px';
    exportContainer.style.padding = '40px';
    exportContainer.style.backgroundColor = '#ffffff';
    exportContainer.style.color = '#000000';
    exportContainer.style.fontFamily = 'Arial, sans-serif';

    let content = `
      <h1 style="font-size: 24px; margin-bottom: 20px;">AI Camera Session</h1>
      <p style="margin-bottom: 10px;"><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    `;

    if (user) {
      content += `<p style="margin-bottom: 20px;"><strong>User:</strong> ${user.username}</p>`;
    }

    if (lastCapture) {
      content += `
        <h2 style="font-size: 18px; margin: 30px 0 15px 0;">Captured Image</h2>
        <img src="${lastCapture.dataUrl}" style="max-width: 100%; height: auto; border: 1px solid #ccc; margin-bottom: 15px;" />
        <p style="margin-bottom: 20px;"><strong>Captured:</strong> ${lastCapture.timestamp.toLocaleString()}</p>
      `;
    }

    if (aiDescription) {
      content += `
        <h2 style="font-size: 18px; margin: 30px 0 15px 0;">AI Description</h2>
        <p style="line-height: 1.6; margin-bottom: 20px;">${aiDescription}</p>
      `;
    }

    exportContainer.innerHTML = content;
    document.body.appendChild(exportContainer);

    const canvas = await html2canvas(exportContainer);
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL();
    link.click();

    document.body.removeChild(exportContainer);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] w-[95vw] sm:w-full flex flex-col p-0">
          <DialogHeader className="p-6 pb-0 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Settings
            </DialogTitle>
            <DialogDescription>
              Configure your camera app preferences and export settings.
            </DialogDescription>
          </DialogHeader>

          {/* Tabbed Content - Scrollable */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="ai" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mx-6 mt-4">
                <TabsTrigger value="ai" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI
                </TabsTrigger>
                <TabsTrigger value="ui" className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  UI
                </TabsTrigger>
                <TabsTrigger value="pdf" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF
                </TabsTrigger>
              </TabsList>

              {/* AI Tab */}
              <TabsContent value="ai" className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-8" style={{ maxHeight: 'calc(90vh - 240px)' }}>
                <div className="pb-4">
                <div className="space-y-4">
                  {/* Auto-Capture Settings */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Auto-Capture</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="autoCapture">Enable auto-capture</Label>
                        <Switch
                          id="autoCapture"
                          checked={tempSettings.autoCapture}
                          onCheckedChange={(checked) =>
                            setTempSettings(prev => ({ ...prev, autoCapture: checked }))
                          }
                        />
                      </div>

                      {tempSettings.autoCapture && (
                        <>
                          <div className="space-y-2">
                            <Label>Capture Time (seconds)</Label>
                            <Select
                              value={tempSettings.captureTime.toString()}
                              onValueChange={(value) =>
                                setTempSettings(prev => ({ ...prev, captureTime: parseInt(value) }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(num => (
                                  <SelectItem key={num} value={num.toString()}>{num}s</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Capture Amount</Label>
                            <Select
                              value={tempSettings.captureAmount.toString()}
                              onValueChange={(value) =>
                                setTempSettings(prev => ({ ...prev, captureAmount: parseInt(value) }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(num => (
                                  <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Capture Quality</Label>
                            <Select
                              value={tempSettings.captureQuality}
                              onValueChange={(value: 'high' | 'medium' | 'low') =>
                                setTempSettings(prev => ({ ...prev, captureQuality: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center justify-between">
                            <Label htmlFor="completeAlert">Complete alert</Label>
                            <Switch
                              id="completeAlert"
                              checked={tempSettings.completeAlert}
                              onCheckedChange={(checked) =>
                                setTempSettings(prev => ({ ...prev, completeAlert: checked }))
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </Card>

                  {/* Streaming Settings */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      {tempSettings.streaming ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                      Streaming
                    </h3>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="streaming">Enable streaming AI responses</Label>
                      <Switch
                        id="streaming"
                        checked={tempSettings.streaming}
                        onCheckedChange={(checked) =>
                          setTempSettings(prev => ({ ...prev, streaming: checked }))
                        }
                      />
                    </div>
                  </Card>

                  {/* Live Preview Min Size */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Live Preview Min Size
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="maintainAspectRatio">Maintain aspect ratio</Label>
                        <Switch
                          id="maintainAspectRatio"
                          checked={tempSettings.maintainAspectRatio}
                          onCheckedChange={(checked) => {
                            setTempSettings(prev => {
                              if (checked) {
                                const aspectHeight = Math.round((prev.previewMinWidth * 9) / 16);
                                return {
                                  ...prev,
                                  maintainAspectRatio: checked,
                                  previewMinHeight: aspectHeight
                                };
                              }
                              return { ...prev, maintainAspectRatio: checked };
                            });
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="previewWidth">Width (px)</Label>
                          <Input
                            id="previewWidth"
                            type="number"
                            min="200"
                            max="1200"
                            value={tempSettings.previewMinWidth}
                            onChange={(e) => {
                              const width = parseInt(e.target.value) || 400;
                              setTempSettings(prev => {
                                if (prev.maintainAspectRatio) {
                                  const aspectHeight = Math.round((width * 9) / 16);
                                  return {
                                    ...prev,
                                    previewMinWidth: width,
                                    previewMinHeight: aspectHeight
                                  };
                                }
                                return { ...prev, previewMinWidth: width };
                              });
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="previewHeight">Height (px)</Label>
                          <Input
                            id="previewHeight"
                            type="number"
                            min="150"
                            max="800"
                            value={tempSettings.previewMinHeight}
                            disabled={tempSettings.maintainAspectRatio}
                            onChange={(e) => {
                              const height = parseInt(e.target.value) || 225;
                              setTempSettings(prev => ({
                                ...prev,
                                previewMinHeight: height
                              }));
                            }}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Set the minimum size for the camera preview when minimized.
                        {tempSettings.maintainAspectRatio && " Height is auto-calculated to maintain 16:9 aspect ratio."}
                      </p>
                    </div>
                  </Card>

                  {/* Capture Image Name */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Capture Image Name</h3>
                    <div className="space-y-2">
                      <Label htmlFor="captureImageName">Default name for captured images</Label>
                      <Input
                        id="captureImageName"
                        type="text"
                        value={tempSettings.captureImageName}
                        onChange={(e) =>
                          setTempSettings(prev => ({ ...prev, captureImageName: e.target.value }))
                        }
                        placeholder="Capture"
                      />
                      <p className="text-xs text-muted-foreground">
                        This name will be used as the base name for captured images.
                      </p>
                    </div>
                  </Card>

                  {/* Custom AI Prompt */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Custom AI Prompt</h3>
                    <div className="space-y-2">
                      <Label htmlFor="customAiPrompt">AI description prompt template</Label>
                      <textarea
                        id="customAiPrompt"
                        value={tempSettings.customAiPrompt}
                        onChange={(e) =>
                          setTempSettings(prev => ({ ...prev, customAiPrompt: e.target.value }))
                        }
                        placeholder="Analyze this image in detail and provide a comprehensive description."
                        className="w-full h-20 px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        This prompt will be used as the base instruction for AI image analysis.
                      </p>
                    </div>
                  </Card>

                  {/* TTS Settings */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      Text-to-Speech
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>TTS Engine</Label>
                        <Select
                          value={tempSettings.ttsEngine}
                          onValueChange={(value: 'standard' | 'neural' | 'generative') =>
                            setTempSettings(prev => ({ ...prev, ttsEngine: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="neural">Neural</SelectItem>
                            <SelectItem value="generative">Generative</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Choose the TTS engine quality. Neural and Generative provide more natural speech.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Voice Selection</Label>
                        <Select
                          value={`${tempSettings.ttsVoice.language}-${tempSettings.ttsVoice.name}-${tempSettings.ttsVoice.engine}`}
                          onValueChange={(value) => {
                            const selectedVoice = AVAILABLE_VOICES.find(voice => 
                              `${voice.language}-${voice.name}-${voice.engine}` === value
                            );
                            if (selectedVoice) {
                              setTempSettings(prev => ({ 
                                ...prev, 
                                ttsVoice: selectedVoice,
                                ttsEngine: selectedVoice.engine
                              }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_VOICES.map((voice) => (
                              <SelectItem 
                                key={`${voice.language}-${voice.name}-${voice.engine}`}
                                value={`${voice.language}-${voice.name}-${voice.engine}`}
                              >
                                {voice.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Select a voice and accent. The engine will automatically match your selection.
                        </p>
                      </div>
                    </div>
                  </Card>


                </div>
                </div>
              </TabsContent>

              {/* UI Tab */}
              <TabsContent value="ui" className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-8" style={{ maxHeight: 'calc(90vh - 240px)' }}>
                <div className="pb-4">
                <div className="space-y-4">
                  {/* Theme Settings */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Theme
                    </h3>
                    <Select
                      value={tempSettings.theme}
                      onValueChange={(value: 'light' | 'dark') =>
                        setTempSettings(prev => ({ ...prev, theme: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </Card>

                  {/* Tooltips */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Tooltips
                    </h3>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="tooltips">Show tooltips on hover</Label>
                      <Switch
                        id="tooltips"
                        checked={tempSettings.tooltips}
                        onCheckedChange={(checked) =>
                          setTempSettings(prev => ({ ...prev, tooltips: checked }))
                        }
                      />
                    </div>
                  </Card>

                  {/* Export Session */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export Session
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => exportSession('pdf')}
                        disabled={isExporting || !lastCapture}
                        className="flex items-center gap-2"
                      >
                        <FileDown className="h-4 w-4" />
                        {isExporting ? 'Exporting...' : 'PDF'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => exportSession('image')}
                        disabled={isExporting || !lastCapture}
                        className="flex items-center gap-2"
                      >
                        <Image className="h-4 w-4" />
                        {isExporting ? 'Exporting...' : 'Image'}
                      </Button>
                    </div>
                  </Card>

                  {/* Reset to Defaults */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </h3>
                    <Button
                      variant="outline"
                      onClick={resetToDefaults}
                      className="w-full"
                    >
                      Reset to Defaults
                    </Button>
                  </Card>
                </div>
                </div>
              </TabsContent>

              {/* PDF Tab - Enhanced Scrolling */}
              <TabsContent value="pdf" className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-8" style={{ maxHeight: 'calc(90vh - 240px)' }}>
                <div className="pb-4">
                <div className="space-y-4">
                  {/* Enhanced PDF Preview Mockup */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">PDF Preview</h3>
                    <div className="flex gap-4 justify-center">
                      {/* Page 1 */}
                      <div
                        className="border rounded-lg p-3 bg-white text-black text-xs flex-1 max-w-[200px] cursor-pointer hover:shadow-lg transition-shadow"
                        style={{
                          aspectRatio: tempSettings.pdfPageOrientation === 'landscape' ? '4/3' : '3/4',
                          fontSize: '8px' // Fixed size for preview, not affected by slider
                        }}
                        onClick={() => setExpandedPreview(true)}
                        title="Click to expand preview"
                      >
                        {/* Header */}
                        <div
                          className="text-white rounded mb-2 font-bold text-center"
                          style={{
                            backgroundColor: tempSettings.pdfHeaderColor,
                            color: tempSettings.pdfTextColor,
                            padding: `${tempSettings.pdfHeaderPadding}px`,
                            margin: `${tempSettings.pdfHeaderMargin}px 0`
                          }}
                        >
                          {tempSettings.pdfIncludeEmojis ? '📸 ' : ''}Live AI Camera Export
                        </div>

                        {/* Content */}
                        <div className="space-y-1">
                          {tempSettings.pdfIncludeTimestamp && (
                            <p><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
                          )}
                          {tempSettings.pdfIncludeUserInfo && (
                            <p><strong>User:</strong> {tempSettings.pdfCustomUserInfo || user?.username || 'User'}</p>
                          )}

                          <div style={{ margin: `${tempSettings.pdfImageMargin}px 0` }}>
                            <p className="font-semibold">{tempSettings.pdfIncludeEmojis ? '📸 ' : ''}Captured Image</p>
                            <div
                              className="bg-gray-200 rounded mt-1 flex items-center justify-center text-gray-500"
                              style={{
                                height: tempSettings.pdfImageSize === 'large' ? '60px' :
                                  tempSettings.pdfImageSize === 'medium' ? '45px' : '30px',
                                padding: `${tempSettings.pdfImagePadding}px`,
                                border: `1px solid ${tempSettings.pdfBorderColor}`
                              }}
                            >
                              [Image]
                            </div>
                          </div>

                          <div style={{ margin: `${tempSettings.pdfTextMargin}px 0` }}>
                            <p className="font-semibold">{tempSettings.pdfIncludeEmojis ? '🤖 ' : ''}AI Description</p>
                            <div
                              className="text-xs mt-1"
                              style={{
                                color: tempSettings.pdfTextColor,
                                padding: `${tempSettings.pdfTextPadding}px`,
                                border: tempSettings.pdfDescriptionBorder ? `1px solid ${tempSettings.pdfBorderColor}` : 'none',
                                borderRadius: tempSettings.pdfDescriptionBorder ? '4px' : '0'
                              }}
                            >
                              <p>Sample AI description...</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Page 2 (if multiple pages) */}
                      <div
                        className="border rounded-lg p-3 bg-white text-black text-xs flex-1 max-w-[200px] cursor-pointer hover:shadow-lg transition-shadow"
                        style={{
                          aspectRatio: tempSettings.pdfPageOrientation === 'landscape' ? '4/3' : '3/4',
                          fontSize: '8px' // Fixed size for preview, not affected by slider
                        }}
                        onClick={() => setExpandedPreview(true)}
                        title="Click to expand preview"
                      >
                        <div
                          className="text-white rounded mb-2 font-bold text-center"
                          style={{
                            backgroundColor: tempSettings.pdfHeaderColor,
                            color: tempSettings.pdfTextColor,
                            padding: `${tempSettings.pdfHeaderPadding}px`,
                            margin: `${tempSettings.pdfHeaderMargin}px 0`
                          }}
                        >
                          Page 2
                        </div>
                        <div className="text-center text-gray-400 mt-8">
                          <p>Additional content...</p>
                          <p>Continued description...</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Live preview showing centered PDF pages with current styling settings.
                    </p>
                  </Card>

                  {/* Colors Section */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Colors</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="pdfHeaderColor">Header</Label>
                        <div className="flex gap-2">
                          <Input
                            id="pdfHeaderColor"
                            type="color"
                            value={tempSettings.pdfHeaderColor}
                            onChange={(e) =>
                              setTempSettings(prev => ({ ...prev, pdfHeaderColor: e.target.value }))
                            }
                            className="w-12 h-8 p-1"
                          />
                          <Input
                            type="text"
                            value={tempSettings.pdfHeaderColor}
                            onChange={(e) =>
                              setTempSettings(prev => ({ ...prev, pdfHeaderColor: e.target.value }))
                            }
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pdfTextColor">Text</Label>
                        <div className="flex gap-2">
                          <Input
                            id="pdfTextColor"
                            type="color"
                            value={tempSettings.pdfTextColor}
                            onChange={(e) =>
                              setTempSettings(prev => ({ ...prev, pdfTextColor: e.target.value }))
                            }
                            className="w-12 h-8 p-1"
                          />
                          <Input
                            type="text"
                            value={tempSettings.pdfTextColor}
                            onChange={(e) =>
                              setTempSettings(prev => ({ ...prev, pdfTextColor: e.target.value }))
                            }
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pdfBorderColor">Borders</Label>
                        <div className="flex gap-2">
                          <Input
                            id="pdfBorderColor"
                            type="color"
                            value={tempSettings.pdfBorderColor}
                            onChange={(e) =>
                              setTempSettings(prev => ({ ...prev, pdfBorderColor: e.target.value }))
                            }
                            className="w-12 h-8 p-1"
                          />
                          <Input
                            type="text"
                            value={tempSettings.pdfBorderColor}
                            onChange={(e) =>
                              setTempSettings(prev => ({ ...prev, pdfBorderColor: e.target.value }))
                            }
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pdfGradientColor">Gradients</Label>
                        <div className="flex gap-2">
                          <Input
                            id="pdfGradientColor"
                            type="color"
                            value={tempSettings.pdfGradientColor}
                            onChange={(e) =>
                              setTempSettings(prev => ({ ...prev, pdfGradientColor: e.target.value }))
                            }
                            className="w-12 h-8 p-1"
                          />
                          <Input
                            type="text"
                            value={tempSettings.pdfGradientColor}
                            onChange={(e) =>
                              setTempSettings(prev => ({ ...prev, pdfGradientColor: e.target.value }))
                            }
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Page Layout */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Page Layout</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Page Orientation</Label>
                        <Select
                          value={tempSettings.pdfPageOrientation}
                          onValueChange={(value: 'portrait' | 'landscape') =>
                            setTempSettings(prev => ({ ...prev, pdfPageOrientation: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portrait">Portrait</SelectItem>
                            <SelectItem value="landscape">Landscape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Image Size</Label>
                        <Select
                          value={tempSettings.pdfImageSize}
                          onValueChange={(value: 'small' | 'medium' | 'large') =>
                            setTempSettings(prev => ({ ...prev, pdfImageSize: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>

                  {/* Include in PDF */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Include in PDF</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pdfIncludeTimestamp">Include timestamp</Label>
                        <Switch
                          id="pdfIncludeTimestamp"
                          checked={tempSettings.pdfIncludeTimestamp}
                          onCheckedChange={(checked) =>
                            setTempSettings(prev => ({ ...prev, pdfIncludeTimestamp: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pdfIncludeUserInfo">Include user information</Label>
                        <Switch
                          id="pdfIncludeUserInfo"
                          checked={tempSettings.pdfIncludeUserInfo}
                          onCheckedChange={(checked) =>
                            setTempSettings(prev => ({ ...prev, pdfIncludeUserInfo: checked }))
                          }
                        />
                      </div>
                      {tempSettings.pdfIncludeUserInfo && (
                        <div className="space-y-2">
                          <Label htmlFor="pdfCustomUserInfo">Custom user information</Label>
                          <Input
                            id="pdfCustomUserInfo"
                            type="text"
                            value={tempSettings.pdfCustomUserInfo}
                            onChange={(e) =>
                              setTempSettings(prev => ({ ...prev, pdfCustomUserInfo: e.target.value }))
                            }
                            placeholder="Enter custom user info or leave blank for username"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pdfIncludeEmojis">Enable emojis</Label>
                        <Switch
                          id="pdfIncludeEmojis"
                          checked={tempSettings.pdfIncludeEmojis}
                          onCheckedChange={(checked) =>
                            setTempSettings(prev => ({ ...prev, pdfIncludeEmojis: checked }))
                          }
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Styles Section */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Styles</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pdfDescriptionBorder">Description border</Label>
                        <Switch
                          id="pdfDescriptionBorder"
                          checked={tempSettings.pdfDescriptionBorder}
                          onCheckedChange={(checked) =>
                            setTempSettings(prev => ({ ...prev, pdfDescriptionBorder: checked }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pdfTextSize">Text size: {tempSettings.pdfTextSizePercent}%</Label>
                        <input
                          id="pdfTextSize"
                          type="range"
                          min="50"
                          max="200"
                          value={tempSettings.pdfTextSizePercent}
                          onChange={(e) =>
                            setTempSettings(prev => ({ ...prev, pdfTextSizePercent: parseInt(e.target.value) }))
                          }
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground">
                          Applies to all text while maintaining hierarchy (H1, H2, H3, etc.)
                        </p>
                      </div>

                      {/* Padding Controls */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Padding (px)</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="pdfHeaderPadding" className="text-xs">Header</Label>
                            <Input
                              id="pdfHeaderPadding"
                              type="number"
                              min="0"
                              max="50"
                              value={tempSettings.pdfHeaderPadding}
                              onChange={(e) =>
                                setTempSettings(prev => ({ ...prev, pdfHeaderPadding: parseInt(e.target.value) || 0 }))
                              }
                              className="text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="pdfImagePadding" className="text-xs">Images</Label>
                            <Input
                              id="pdfImagePadding"
                              type="number"
                              min="0"
                              max="50"
                              value={tempSettings.pdfImagePadding}
                              onChange={(e) =>
                                setTempSettings(prev => ({ ...prev, pdfImagePadding: parseInt(e.target.value) || 0 }))
                              }
                              className="text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="pdfTextPadding" className="text-xs">Text</Label>
                            <Input
                              id="pdfTextPadding"
                              type="number"
                              min="0"
                              max="50"
                              value={tempSettings.pdfTextPadding}
                              onChange={(e) =>
                                setTempSettings(prev => ({ ...prev, pdfTextPadding: parseInt(e.target.value) || 0 }))
                              }
                              className="text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Margin Controls */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Margins (px)</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="pdfHeaderMargin" className="text-xs">Header</Label>
                            <Input
                              id="pdfHeaderMargin"
                              type="number"
                              min="0"
                              max="50"
                              value={tempSettings.pdfHeaderMargin}
                              onChange={(e) =>
                                setTempSettings(prev => ({ ...prev, pdfHeaderMargin: parseInt(e.target.value) || 0 }))
                              }
                              className="text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="pdfImageMargin" className="text-xs">Images</Label>
                            <Input
                              id="pdfImageMargin"
                              type="number"
                              min="0"
                              max="50"
                              value={tempSettings.pdfImageMargin}
                              onChange={(e) =>
                                setTempSettings(prev => ({ ...prev, pdfImageMargin: parseInt(e.target.value) || 0 }))
                              }
                              className="text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="pdfTextMargin" className="text-xs">Text</Label>
                            <Input
                              id="pdfTextMargin"
                              type="number"
                              min="0"
                              max="50"
                              value={tempSettings.pdfTextMargin}
                              onChange={(e) =>
                                setTempSettings(prev => ({ ...prev, pdfTextMargin: parseInt(e.target.value) || 0 }))
                              }
                              className="text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* AI Analysis Features - Moved from AI Tab */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">AI Analysis Features</h3>
                    <div className="space-y-4">
                      {/* Person Analysis */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="aiPersonAnalysis">Person Analysis</Label>
                            <p className="text-xs text-muted-foreground">Analyze people in images</p>
                          </div>
                          <Switch
                            id="aiPersonAnalysis"
                            checked={tempSettings.aiPersonAnalysis}
                            onCheckedChange={(checked) =>
                              setTempSettings(prev => ({ ...prev, aiPersonAnalysis: checked }))
                            }
                          />
                        </div>
                        {tempSettings.aiPersonAnalysis && (
                          <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiPersonGender"
                                checked={tempSettings.aiPersonGender}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiPersonGender: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiPersonGender" className="text-sm">Gender detection</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiPersonAge"
                                checked={tempSettings.aiPersonAge}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiPersonAge: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiPersonAge" className="text-sm">Age estimation</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiPersonMood"
                                checked={tempSettings.aiPersonMood}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiPersonMood: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiPersonMood" className="text-sm">Mood detection</Label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Scenery Analysis */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="aiSceneryAnalysis">Scenery Analysis</Label>
                            <p className="text-xs text-muted-foreground">Analyze environment and setting</p>
                          </div>
                          <Switch
                            id="aiSceneryAnalysis"
                            checked={tempSettings.aiSceneryAnalysis}
                            onCheckedChange={(checked) =>
                              setTempSettings(prev => ({ ...prev, aiSceneryAnalysis: checked }))
                            }
                          />
                        </div>
                        {tempSettings.aiSceneryAnalysis && (
                          <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiSceneryTime"
                                checked={tempSettings.aiSceneryTime}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiSceneryTime: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiSceneryTime" className="text-sm">Time of day</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiSceneryWeather"
                                checked={tempSettings.aiSceneryWeather}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiSceneryWeather: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiSceneryWeather" className="text-sm">Weather conditions</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiSceneryLocation"
                                checked={tempSettings.aiSceneryLocation}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiSceneryLocation: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiSceneryLocation" className="text-sm">Location type</Label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Object Analysis */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="aiObjectAnalysis">Object Analysis</Label>
                            <p className="text-xs text-muted-foreground">Identify and analyze objects</p>
                          </div>
                          <Switch
                            id="aiObjectAnalysis"
                            checked={tempSettings.aiObjectAnalysis}
                            onCheckedChange={(checked) =>
                              setTempSettings(prev => ({ ...prev, aiObjectAnalysis: checked }))
                            }
                          />
                        </div>
                        {tempSettings.aiObjectAnalysis && (
                          <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiObjectName"
                                checked={tempSettings.aiObjectName}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiObjectName: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiObjectName" className="text-sm">Object names</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiObjectSize"
                                checked={tempSettings.aiObjectSize}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiObjectSize: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiObjectSize" className="text-sm">Size estimation</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiObjectText"
                                checked={tempSettings.aiObjectText}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiObjectText: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiObjectText" className="text-sm">Text extraction</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiObjectUses"
                                checked={tempSettings.aiObjectUses}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiObjectUses: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiObjectUses" className="text-sm">Object uses</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiObjectFacts"
                                checked={tempSettings.aiObjectFacts}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiObjectFacts: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiObjectFacts" className="text-sm">Interesting facts</Label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Random Analysis */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="aiRandomAnalysis">Additional Details</Label>
                            <p className="text-xs text-muted-foreground">Extra contextual information</p>
                          </div>
                          <Switch
                            id="aiRandomAnalysis"
                            checked={tempSettings.aiRandomAnalysis}
                            onCheckedChange={(checked) =>
                              setTempSettings(prev => ({ ...prev, aiRandomAnalysis: checked }))
                            }
                          />
                        </div>
                        {tempSettings.aiRandomAnalysis && (
                          <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiRandomColors"
                                checked={tempSettings.aiRandomColors}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiRandomColors: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiRandomColors" className="text-sm">Dominant colors</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiRandomLocation"
                                checked={tempSettings.aiRandomLocation}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiRandomLocation: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiRandomLocation" className="text-sm">Geographic location</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiRandomPeopleCount"
                                checked={tempSettings.aiRandomPeopleCount}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiRandomPeopleCount: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiRandomPeopleCount" className="text-sm">People count</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="aiRandomVehicles"
                                checked={tempSettings.aiRandomVehicles}
                                onChange={(e) =>
                                  setTempSettings(prev => ({ ...prev, aiRandomVehicles: e.target.checked }))
                                }
                                className="rounded"
                              />
                              <Label htmlFor="aiRandomVehicles" className="text-sm">Vehicle identification</Label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sticky Footer Actions */}
          <div className="flex gap-2 p-6 pt-4 border-t bg-background flex-shrink-0">
            <Button variant="outline" onClick={cancelChanges} className="flex-1">
              Cancel
            </Button>
            <Button onClick={saveSettings} className="flex-1">
              Save Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded PDF Preview Dialog */}
      <Dialog open={expandedPreview} onOpenChange={setExpandedPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>PDF Preview - Expanded View</DialogTitle>
            <DialogDescription>
              Preview of how your PDF will look with current settings
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
            <div className="flex gap-6 justify-center">
              {/* Expanded Page 1 */}
              <div
                className="border rounded-lg p-6 bg-white text-black text-sm shadow-lg"
                style={{
                  aspectRatio: tempSettings.pdfPageOrientation === 'landscape' ? '4/3' : '3/4',
                  width: tempSettings.pdfPageOrientation === 'landscape' ? '400px' : '300px',
                  fontSize: '10px' // Fixed readable size for expanded view
                }}
              >
                {/* Header */}
                <div
                  className="text-white rounded mb-4 font-bold text-center"
                  style={{
                    backgroundColor: tempSettings.pdfHeaderColor,
                    color: tempSettings.pdfTextColor,
                    padding: `${tempSettings.pdfHeaderPadding}px`,
                    margin: `${tempSettings.pdfHeaderMargin}px 0`
                  }}
                >
                  {tempSettings.pdfIncludeEmojis ? '📸 ' : ''}Live AI Camera Export
                </div>

                {/* Content */}
                <div className="space-y-3">
                  {tempSettings.pdfIncludeTimestamp && (
                    <p><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
                  )}
                  {tempSettings.pdfIncludeUserInfo && (
                    <p><strong>User:</strong> {tempSettings.pdfCustomUserInfo || user?.username || 'User'}</p>
                  )}

                  <div style={{ margin: `${tempSettings.pdfImageMargin}px 0` }}>
                    <p className="font-semibold">{tempSettings.pdfIncludeEmojis ? '📸 ' : ''}Captured Image</p>
                    <div
                      className="bg-gray-200 rounded mt-2 flex items-center justify-center text-gray-500"
                      style={{
                        height: tempSettings.pdfImageSize === 'large' ? '120px' :
                          tempSettings.pdfImageSize === 'medium' ? '90px' : '60px',
                        padding: `${tempSettings.pdfImagePadding}px`,
                        border: `1px solid ${tempSettings.pdfBorderColor}`
                      }}
                    >
                      [Sample Image Preview]
                    </div>
                  </div>

                  <div style={{ margin: `${tempSettings.pdfTextMargin}px 0` }}>
                    <p className="font-semibold">{tempSettings.pdfIncludeEmojis ? '🤖 ' : ''}AI Description</p>
                    <div
                      className="text-sm mt-2 leading-relaxed"
                      style={{
                        color: tempSettings.pdfTextColor,
                        padding: `${tempSettings.pdfTextPadding}px`,
                        border: tempSettings.pdfDescriptionBorder ? `1px solid ${tempSettings.pdfBorderColor}` : 'none',
                        borderRadius: tempSettings.pdfDescriptionBorder ? '4px' : '0'
                      }}
                    >
                      <p>This is a sample AI description showing how your formatted text will appear in the final PDF. The description will include detailed analysis based on your AI settings, with proper formatting and spacing according to your preferences.</p>
                      <p className="mt-2">Additional paragraphs will be properly spaced and formatted according to your text settings.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Page 2 */}
              <div
                className="border rounded-lg p-6 bg-white text-black text-sm shadow-lg"
                style={{
                  aspectRatio: tempSettings.pdfPageOrientation === 'landscape' ? '4/3' : '3/4',
                  width: tempSettings.pdfPageOrientation === 'landscape' ? '400px' : '300px',
                  fontSize: '10px'
                }}
              >
                <div
                  className="text-white rounded mb-4 font-bold text-center"
                  style={{
                    backgroundColor: tempSettings.pdfHeaderColor,
                    color: tempSettings.pdfTextColor,
                    padding: `${tempSettings.pdfHeaderPadding}px`,
                    margin: `${tempSettings.pdfHeaderMargin}px 0`
                  }}
                >
                  Page 2 of Export
                </div>
                <div className="text-center text-gray-600 mt-12">
                  <p className="mb-4">Additional content pages will follow this format...</p>
                  <p className="mb-4">Continued descriptions and multiple captures will be properly formatted.</p>
                  <p className="text-xs text-gray-400">Footer information and page numbers will appear here</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t bg-background p-4">
            <Button
              variant="outline"
              onClick={() => setExpandedPreview(false)}
              className="w-full"
            >
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Wrap with memo for performance optimization
export const SettingsModal: React.FC<SettingsModalProps> = memo(SettingsModalInner, (prevProps, nextProps) => {
  // Custom comparison function for memo optimization
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.user?.username === nextProps.user?.username &&
    prevProps.lastCapture?.timestamp === nextProps.lastCapture?.timestamp &&
    prevProps.aiDescription === nextProps.aiDescription &&
    prevProps.onClose === nextProps.onClose &&
    prevProps.onSettingsChange === nextProps.onSettingsChange
  );
});

// Add display name for debugging
SettingsModal.displayName = 'SettingsModal';

