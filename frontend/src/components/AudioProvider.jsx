import { createContext, useContext, useRef } from 'react';

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const arrowSoundRef = useRef(null);
  const clickSoundRef = useRef(null);

  const playSound = (audioRef) => {
    const audio = audioRef.current;
    if (!audio) return Promise.resolve();
    audio.currentTime = 0;
    return audio.play().catch((err) => {
      console.log('Sound play failed:', err);
    });
  };

  const value = {
    playArrow: () => playSound(arrowSoundRef),
    playClick: () => playSound(clickSoundRef),
  };

  return (
    <AudioContext.Provider value={value}>
      {children}

      {/* global audio elements available on every page */}
      <audio ref={arrowSoundRef} src="/sounds/press.mp3" preload="auto" />
      <audio ref={clickSoundRef} src="/sounds/click.mp3" preload="auto" />
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    throw new Error('useAudio must be used inside <AudioProvider>');
  }
  return ctx;
}