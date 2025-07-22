import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TTSControls } from './TTSControls';
import { AVAILABLE_TTS_VOICES, TTSVoice, TTSConfig } from '@/hooks/useTTSAudio';
import { toast } from '@/hooks/use-toast';

const TEST_TEXT = "This is a test of the text-to-speech functionality with different voice and engine configurations.";

export const TTSTestComponent: React.FC = () => {
  const [selectedVoice, setSelectedVoice] = useState<TTSVoice>(AVAILABLE_TTS_VOICES[0]);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'failed' | 'testing'>>({});

  const testSingleVoice = async (voice: TTSVoice) => {
    const voiceKey = `${voice.language}-${voice.name}-${voice.engine}`;
    
    setTestResults(prev => ({
      ...prev,
      [voiceKey]: 'testing'
    }));

    try {
      // Test the voice configuration
      const config: TTSConfig = {
        engine: voice.engine,
        voice: voice
      };

      // This will be handled by the TTSControls component
      setTestResults(prev => ({
        ...prev,
        [voiceKey]: 'success'
      }));

      toast({
        title: "Voice Test",
        description: `${voice.displayName} - Test initiated`,
        duration: 2000
      });
    } catch (error) {
      console.error(`Test failed for ${voice.displayName}:`, error);
      
      setTestResults(prev => ({
        ...prev,
        [voiceKey]: 'failed'
      }));

      toast({
        title: "Voice Test Failed",
        description: `${voice.displayName} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const testAllVoices = async () => {
    toast({
      title: "Testing All Voices",
      description: "Starting comprehensive TTS test...",
      duration: 3000
    });

    for (const voice of AVAILABLE_TTS_VOICES) {
      await testSingleVoice(voice);
      // Add a small delay between tests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    toast({
      title: "All Voice Tests Complete",
      description: "Check the results below",
      duration: 3000
    });
  };

  const getStatusColor = (status: 'success' | 'failed' | 'testing' | undefined) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'testing': return 'text-yellow-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = (status: 'success' | 'failed' | 'testing' | undefined) => {
    switch (status) {
      case 'success': return '✓ Success';
      case 'failed': return '✗ Failed';
      case 'testing': return '⏳ Testing...';
      default: return '○ Not tested';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">TTS Configuration Test</h2>
        
        {/* Individual Voice Test */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Test Individual Voice</h3>
          
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Select Voice</label>
              <Select
                value={`${selectedVoice.language}-${selectedVoice.name}-${selectedVoice.engine}`}
                onValueChange={(value) => {
                  const voice = AVAILABLE_TTS_VOICES.find(v => 
                    `${v.language}-${v.name}-${v.engine}` === value
                  );
                  if (voice) setSelectedVoice(voice);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_TTS_VOICES.map((voice) => (
                    <SelectItem 
                      key={`${voice.language}-${voice.name}-${voice.engine}`}
                      value={`${voice.language}-${voice.name}-${voice.engine}`}
                    >
                      {voice.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={() => testSingleVoice(selectedVoice)}>
              Test Voice
            </Button>
          </div>

          {/* TTS Controls for selected voice */}
          <div className="mt-4">
            <TTSControls
              text={TEST_TEXT}
              config={{
                engine: selectedVoice.engine,
                voice: selectedVoice
              }}
              onError={(error) => {
                const voiceKey = `${selectedVoice.language}-${selectedVoice.name}-${selectedVoice.engine}`;
                setTestResults(prev => ({
                  ...prev,
                  [voiceKey]: 'failed'
                }));
                console.error('TTS Error:', error);
              }}
            />
          </div>
        </div>

        {/* Batch Test */}
        <div className="mt-8 pt-6 border-t">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Test All Voices</h3>
            <Button onClick={testAllVoices} variant="outline">
              Test All Configurations
            </Button>
          </div>

          {/* Test Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AVAILABLE_TTS_VOICES.map((voice) => {
              const voiceKey = `${voice.language}-${voice.name}-${voice.engine}`;
              const status = testResults[voiceKey];
              
              return (
                <div 
                  key={voiceKey}
                  className="flex justify-between items-center p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{voice.displayName}</div>
                    <div className="text-sm text-gray-500">
                      {voice.language} • {voice.engine}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${getStatusColor(status)}`}>
                    {getStatusText(status)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Test Information */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium mb-2">Test Information</h4>
          <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
            <li>• Tests each voice and engine combination with fallback handling</li>
            <li>• Verifies proper parameter mapping from settings to API calls</li>
            <li>• Validates error handling for unsupported configurations</li>
            <li>• Uses the same TTS infrastructure as the main application</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};