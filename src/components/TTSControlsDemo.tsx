import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { TTSControls } from './TTSControls';
import { AVAILABLE_TTS_VOICES, TTSConfig } from '@/hooks/useTTSAudio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const TTSControlsDemo: React.FC = () => {
  const [text, setText] = useState('Hello! This is a test of the text-to-speech controls with audio scrubbing functionality.');
  const [selectedVoice, setSelectedVoice] = useState(AVAILABLE_TTS_VOICES[0]);

  const ttsConfig: Partial<TTSConfig> = {
    voice: selectedVoice
  };

  const handlePlayStart = () => {
    console.log('TTS playback started');
  };

  const handlePlayEnd = () => {
    console.log('TTS playback ended');
  };

  const handleError = (error: string) => {
    console.error('TTS error:', error);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">TTS Controls Demo</h1>
      
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="demo-text">Text to speak:</Label>
          <Textarea
            id="demo-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            className="min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Voice Selection:</Label>
          <Select
            value={selectedVoice.displayName}
            onValueChange={(value) => {
              const voice = AVAILABLE_TTS_VOICES.find(v => v.displayName === value);
              if (voice) setSelectedVoice(voice);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_TTS_VOICES.map((voice) => (
                <SelectItem key={voice.displayName} value={voice.displayName}>
                  {voice.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">TTS Controls</h3>
          
          {/* Default variant */}
          <div className="space-y-2">
            <Label>Default Style:</Label>
            <TTSControls
              text={text}
              config={ttsConfig}
              onPlayStart={handlePlayStart}
              onPlayEnd={handlePlayEnd}
              onError={handleError}
            />
          </div>

          {/* Ghost variant without scrub bar */}
          <div className="space-y-2">
            <Label>Ghost Style (No Scrub Bar):</Label>
            <TTSControls
              text={text}
              config={ttsConfig}
              variant="ghost"
              showScrubBar={false}
              onPlayStart={handlePlayStart}
              onPlayEnd={handlePlayEnd}
              onError={handleError}
            />
          </div>

          {/* Large size variant */}
          <div className="space-y-2">
            <Label>Large Size:</Label>
            <TTSControls
              text={text}
              config={ttsConfig}
              size="lg"
              variant="default"
              onPlayStart={handlePlayStart}
              onPlayEnd={handlePlayEnd}
              onError={handleError}
            />
          </div>

          {/* Disabled state */}
          <div className="space-y-2">
            <Label>Disabled State:</Label>
            <TTSControls
              text=""
              config={ttsConfig}
              disabled={true}
              onPlayStart={handlePlayStart}
              onPlayEnd={handlePlayEnd}
              onError={handleError}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};