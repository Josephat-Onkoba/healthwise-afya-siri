import React, { useState, useEffect, useRef } from 'react';
import { FiVolume2, FiVolumeX, FiLoader } from 'react-icons/fi';

interface AudioResponseProps {
  text: string;
  language: string;
}

const AudioResponse: React.FC<AudioResponseProps> = ({ text, language }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Cleanup function
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handlePlay = async () => {
    try {
      setError(null);
      
      if (isPlaying) {
        // Stop current playback
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        return;
      }

      setIsLoading(true);

      // Create speech synthesis utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Store reference to current utterance
      utteranceRef.current = utterance;

      // Set up event handlers
      utterance.onend = () => {
        setIsPlaying(false);
        setIsLoading(false);
      };

      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        setError('Failed to play audio. Please try again.');
        setIsPlaying(false);
        setIsLoading(false);
      };

      // Start playback
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error playing audio:', error);
      setError('Failed to play audio. Please try again.');
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handlePlay}
        disabled={!text || isLoading}
        className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
      >
        {isLoading ? (
          <FiLoader className="animate-spin text-blue-500" />
        ) : isPlaying ? (
          <FiVolume2 className="text-blue-500" />
        ) : (
          <FiVolumeX className="text-gray-500" />
        )}
        <span className="text-sm">
          {isLoading ? 'Loading...' : isPlaying ? 'Stop' : 'Play'}
        </span>
      </button>
      
      {error && (
        <div className="text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
};

export default AudioResponse; 