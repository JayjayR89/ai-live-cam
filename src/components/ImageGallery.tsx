
import React, { useState } from 'react';
import { X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';

// Using Puter.com API loaded from CDN
declare const puter: any;

interface CapturedImage {
  dataUrl: string;
  timestamp: Date;
  description?: string;
}

interface ImageGalleryProps {
  images: CapturedImage[];
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<CapturedImage | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const formatDescription = (description: string) => {
    // Add proper formatting for better readability
    return description
      .replace(/\n/g, '<br>')
      .replace(/\. /g, '.<br><br>')
      .replace(/: /g, ':<br>')
      .replace(/\? /g, '?<br><br>')
      .replace(/! /g, '!<br><br>');
  };

  const speakDescription = async (description: string) => {
    if (!description || isSpeaking) return;
    
    setIsSpeaking(true);
    try {
      const audio = await puter.ai.txt2speech(description, {
        voice: "Joanna",
        engine: "standard",
        language: "en-US"
      });
      audio.play();
      
      // Reset speaking state when audio ends
      audio.addEventListener('ended', () => {
        setIsSpeaking(false);
      });
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  };

  if (images.length === 0) return null;

  return (
    <>
      <Card className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Captured Images ({images.length})
        </h3>
        <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
          {images.map((image, index) => (
            <div key={image.timestamp.getTime()} className="flex gap-3 p-3 rounded-lg bg-muted/20 border">
              <img
                src={image.dataUrl}
                alt={`Capture ${index + 1}`}
                className="w-16 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setSelectedImage(image)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">
                    Capture {images.length - index}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {image.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {image.description ? (
                  <div className="space-y-2">
                    <div 
                      className="text-xs text-muted-foreground line-clamp-3"
                      dangerouslySetInnerHTML={{ 
                        __html: formatDescription(image.description).substring(0, 150) + '...' 
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => speakDescription(image.description!)}
                      disabled={isSpeaking}
                      className="h-6 px-2 text-xs"
                      title="Listen to description"
                    >
                      <Volume2 className="h-3 w-3 mr-1" />
                      {isSpeaking ? 'Speaking...' : 'Listen'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-yellow-600">⏳ Processing...</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Full-size image popup */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          {selectedImage && (
            <div className="relative">
              <DialogClose asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
              
              <div className="p-6">
                <img
                  src={selectedImage.dataUrl}
                  alt="Full size capture"
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
                />
                
                {selectedImage.description && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">AI Description</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => speakDescription(selectedImage.description!)}
                        disabled={isSpeaking}
                        className="flex items-center gap-2"
                      >
                        <Volume2 className="h-4 w-4" />
                        {isSpeaking ? 'Speaking...' : 'Listen'}
                      </Button>
                    </div>
                    <div 
                      className="text-sm leading-relaxed prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: formatDescription(selectedImage.description) 
                      }}
                    />
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground mt-4">
                  Captured: {selectedImage.timestamp.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
