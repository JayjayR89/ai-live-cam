import React, { useState, useEffect } from 'react';
import { X, Download, RotateCcw, Bell, BellOff, Palette, Zap, ZapOff, HelpCircle, FileDown, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

interface Settings {
  theme: 'light' | 'dark';
  streaming: boolean;
  autoCapture: boolean;
  captureTime: number;
  captureAmount: number;
  captureQuality: 'high' | 'medium' | 'low';
  completeAlert: boolean;
  tooltips: boolean;
  realTimeDetection?: boolean;
  detectionClasses?: string[];
}

const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
  'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
  'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  user: User | null;
  lastCapture: CapturedImage | null;
  aiDescription: string;
  onSettingsChange?: (settings: Settings) => void;
}

const defaultSettings: Settings = {
  theme: 'dark',
  streaming: true,
  autoCapture: false,
  captureTime: 5,
  captureAmount: 5,
  captureQuality: 'high',
  completeAlert: true,
  tooltips: true,
  realTimeDetection: false,
  detectionClasses: ['person', 'cat', 'dog'],
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  user,
  lastCapture,
  aiDescription,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [tempSettings, setTempSettings] = useState<Settings>(defaultSettings);
  const [isExporting, setIsExporting] = useState(false);

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
        // Ensure theme value is properly typed
        const validSettings: Settings = {
          ...defaultSettings,
          ...savedSettings,
          theme: savedSettings.theme === 'light' ? 'light' : 'dark'
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your camera app preferences and export settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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

          {/* Real-time Detection Settings */}
          <Card className="p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Real-time Object Detection
            </h3>
            <div className="space-y-2 mt-6">
              <Label className="flex items-center gap-2">
                <Switch
                  checked={tempSettings.realTimeDetection}
                  onCheckedChange={checked => setTempSettings(s => ({ ...s, realTimeDetection: checked }))}
                />
                Enable Real-time Object Detection
              </Label>
              {tempSettings.realTimeDetection && (
                <div className="ml-6">
                  <Label className="block mb-2">Highlight Objects:</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {COCO_CLASSES.map(cls => (
                      <Label key={cls} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={tempSettings.detectionClasses?.includes(cls) ?? false}
                          onChange={e => {
                            const checked = e.target.checked;
                            setTempSettings(s => ({
                              ...s,
                              detectionClasses: checked
                                ? [...(s.detectionClasses || []), cls]
                                : (s.detectionClasses || []).filter(c => c !== cls)
                            }));
                          }}
                        />
                        {cls}
                      </Label>
                    ))}
                  </div>
                </div>
              )}
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

        {/* Footer Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={cancelChanges} className="flex-1">
            Cancel
          </Button>
          <Button onClick={saveSettings} className="flex-1">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
