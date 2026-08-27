'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  isMobileBrowser,
  getSpeechRecognitionConstructor,
  cleanAndMergeSpeechResults,
  createSpeechThrottler,
  resolvePhilippineSpeechLanguage,
} from '@/lib/speechRecognition';

export interface UseVoiceInputOptions {
  /**
   * Callback invoked whenever new speech is transcribed.
   * Can be throttled during interim streaming for silky-smooth UI updates.
   */
  onTranscriptChange: (text: string) => void;

  /**
   * The current text in the prompt/textarea. Used as baseText so dictation
   * appends naturally without overwriting manual edits or duplicating.
   */
  currentText?: string;

  /**
   * BCP 47 language tag (e.g. 'en-US', 'fil-PH'). Defaults to navigator.language.
   */
  lang?: string;
}

export interface UseVoiceInputReturn {
  isSupported: boolean;
  isListening: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearError: () => void;
}

export function useVoiceInput({
  onTranscriptChange,
  currentText = '',
  lang,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef(currentText);
  const latestTranscriptRef = useRef('');
  const throttlerRef = useRef<ReturnType<typeof createSpeechThrottler> | null>(null);
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  onTranscriptChangeRef.current = onTranscriptChange;

  // Detect support safely on mount
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (SpeechRecognition) {
      setIsSupported(true);
    }
  }, []);

  // Initialize throttler
  useEffect(() => {
    throttlerRef.current = createSpeechThrottler((text: string) => {
      onTranscriptChangeRef.current(text);
    }, 50);

    return () => {
      throttlerRef.current?.cancel();
    };
  }, []);

  // Stop listening helper
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
      recognitionRef.current = null;
    }
    // Flush any pending interim updates immediately
    if (latestTranscriptRef.current && throttlerRef.current) {
      throttlerRef.current.flush(latestTranscriptRef.current);
    }
    setIsListening(false);
  }, []);

  // Start listening helper
  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    // Stop any existing session
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    setError(null);
    baseTextRef.current = currentText;
    latestTranscriptRef.current = currentText;

    try {
      const recognition = new SpeechRecognition();
      const isMobile = isMobileBrowser();

      // On mobile web (Android Chrome / iOS Safari), setting continuous to true
      // triggers severe audio buffering lag and the duplicate word bug (Chromium Issue 536644).
      // continuous = false uses the low-latency native mobile recognizer.
      // On desktop, continuous = true provides smooth multi-sentence dictation.
      recognition.continuous = !isMobile;
      recognition.interimResults = true;
      recognition.lang = resolvePhilippineSpeechLanguage(lang);

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        if (!event.results || event.results.length === 0) return;

        const combined = cleanAndMergeSpeechResults(
          event.results,
          baseTextRef.current
        );

        latestTranscriptRef.current = combined;

        // Check if the latest result is final
        const lastResult = event.results[event.results.length - 1];
        const isFinal = Boolean(lastResult?.isFinal);

        if (isFinal) {
          // Final result: flush immediately to state without delay
          throttlerRef.current?.flush(combined);
        } else {
          // Interim result: throttle to animation frame to prevent mobile lag
          throttlerRef.current?.schedule(combined);
        }
      };

      recognition.onerror = (event: any) => {
        const err = event.error;
        if (err === 'no-speech') {
          // No speech detected is common during pauses, just end gracefully
          setIsListening(false);
          return;
        }

        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setError(
            'Microphone access was denied. Please allow microphone permissions in your browser to use voice input.'
          );
        } else if (err === 'audio-capture') {
          setError('No microphone was detected on this device.');
        } else if (err === 'network') {
          setError('Speech recognition network error. Please check your connection.');
        } else if (err !== 'aborted') {
          console.warn('[useVoiceInput] Speech recognition error:', err);
        }

        setIsListening(false);
      };

      recognition.onend = () => {
        // Flush any remaining transcribed text
        if (latestTranscriptRef.current && throttlerRef.current) {
          throttlerRef.current.flush(latestTranscriptRef.current);
        }
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('[useVoiceInput] Failed to start recognition:', err);
      setError('Could not start voice input. Please try again.');
      setIsListening(false);
    }
  }, [currentText, lang]);

  // Toggle listening helper
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
      throttlerRef.current?.cancel();
    };
  }, []);

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearError,
  };
}
