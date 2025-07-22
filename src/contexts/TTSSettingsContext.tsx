import React, { createContext, useContext, ReactNode } from 'react';
import { TTSConfig } from '@/hooks/useTTSAudio';

interface TTSSettingsContextType {
  ttsConfig: TTSConfig;
}

const TTSSettingsContext = createContext<TTSSettingsContextType | undefined>(undefined);

interface TTSSettingsProviderProps {
  children: ReactNode;
  ttsConfig: TTSConfig;
}

export const TTSSettingsProvider: React.FC<TTSSettingsProviderProps> = ({
  children,
  ttsConfig
}) => {
  return (
    <TTSSettingsContext.Provider value={{ ttsConfig }}>
      {children}
    </TTSSettingsContext.Provider>
  );
};

export const useTTSSettings = (): TTSSettingsContextType => {
  const context = useContext(TTSSettingsContext);
  if (context === undefined) {
    throw new Error('useTTSSettings must be used within a TTSSettingsProvider');
  }
  return context;
};