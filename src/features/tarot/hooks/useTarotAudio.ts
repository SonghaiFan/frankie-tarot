import { useState, useRef, useCallback } from "react";
import { loadVoiceClip } from "@/features/tarot/services/audio";
import { Locale } from "@/i18n/types";

export function useTarotAudio(locale: Locale) {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const voiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const voicePlaybackRef = useRef<Promise<void> | null>(null);
  const introWelcomePromiseRef = useRef<Promise<void> | null>(null);
  const introGreetingKeyRef = useRef<"WELCOME" | "ASK" | null>(null);
  const hasPlayedIntroWelcomeRef = useRef(false);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
  }, []);

  const stopVoice = useCallback(() => {
    if (voiceSourceRef.current) {
      try {
        voiceSourceRef.current.stop();
      } catch {
        // Ignore already stopped error
      }
      voiceSourceRef.current = null;
      setIsAudioPlaying(false);
    }
  }, []);

  const playBufferAndWait = useCallback((buffer: AudioBuffer) => {
    if (!audioContextRef.current) return Promise.resolve();

    stopVoice();

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;

    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.value = 1.0;

    source.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    voiceSourceRef.current = source;
    setIsAudioPlaying(true);

    const playback = new Promise<void>((resolve) => {
      source.onended = () => {
        if (voiceSourceRef.current === source) {
          voiceSourceRef.current = null;
          setIsAudioPlaying(false);
        }
        if (voicePlaybackRef.current === playback) {
          voicePlaybackRef.current = null;
        }
        resolve();
      };
      source.start();
    });

    voicePlaybackRef.current = playback;
    return playback;
  }, [stopVoice]);

  const playBuffer = useCallback(
    (buffer: AudioBuffer) => {
      void playBufferAndWait(buffer);
    },
    [playBufferAndWait]
  );

  const playVoice = useCallback(
    async (cacheKey: string, staticKey: string): Promise<void> => {
      if (!audioContextRef.current) return;

      const localeCacheKey = cacheKey ? `${locale}:${cacheKey}` : undefined;

      if (localeCacheKey && audioCacheRef.current.has(localeCacheKey)) {
        playBuffer(audioCacheRef.current.get(localeCacheKey)!);
        return;
      }

      try {
        const buffer = await loadVoiceClip(staticKey, audioContextRef.current, locale);
        if (buffer) {
          if (localeCacheKey) audioCacheRef.current.set(localeCacheKey, buffer);
          playBuffer(buffer);
        }
      } catch (err) {
        console.error("Voice playback failed", err);
      }
    },
    [locale, playBuffer]
  );

  const playVoiceAndWait = useCallback(
    async (cacheKey: string, staticKey: string): Promise<void> => {
      if (!audioContextRef.current) return;

      const localeCacheKey = cacheKey ? `${locale}:${cacheKey}` : undefined;

      if (localeCacheKey && audioCacheRef.current.has(localeCacheKey)) {
        await playBufferAndWait(audioCacheRef.current.get(localeCacheKey)!);
        return;
      }

      try {
        const buffer = await loadVoiceClip(staticKey, audioContextRef.current, locale);
        if (buffer) {
          if (localeCacheKey) audioCacheRef.current.set(localeCacheKey, buffer);
          await playBufferAndWait(buffer);
        }
      } catch (err) {
        console.error("Voice playback failed", err);
      }
    },
    [locale, playBufferAndWait]
  );

  const waitForVoiceToFinish = useCallback(async () => {
    if (voicePlaybackRef.current) {
      await voicePlaybackRef.current;
    }
  }, []);

  const playIntroWelcome = useCallback(async () => {
    if (introWelcomePromiseRef.current) {
      await introWelcomePromiseRef.current;
      return;
    }

    if (hasPlayedIntroWelcomeRef.current) return;

    hasPlayedIntroWelcomeRef.current = true;
    introWelcomePromiseRef.current = (async () => {
      initAudio();

      await new Promise((resolve) => setTimeout(resolve, 100));
      const selectedKey =
        introGreetingKeyRef.current ??
        (Math.random() < 0.5 ? "WELCOME" : "ASK");
      introGreetingKeyRef.current = selectedKey;

      await playVoiceAndWait(
        selectedKey,
        selectedKey.toLowerCase()
      );
    })();

    await introWelcomePromiseRef.current;
  }, [initAudio, playVoiceAndWait]);

  const prefetchStaticAudio = useCallback(async () => {
    if (!audioContextRef.current) return;
    for (const key of ["ASK", "PICK", "REVEAL"]) {
      const cacheKey = `${locale}:${key}`;
      if (!audioCacheRef.current.has(cacheKey)) {
        loadVoiceClip(key.toLowerCase(), audioContextRef.current, locale)
          .then((buf) => {
            if (buf) audioCacheRef.current.set(cacheKey, buf);
          })
          .catch(() => {
            /* Ignore prefetch errors */
          });
      }
    }
  }, [locale]);

  return {
    isAudioPlaying,
    audioContextRef,
    hasPlayedIntroWelcomeRef,
    initAudio,
    stopVoice,
    playBuffer,
    playBufferAndWait,
    playVoice,
    playVoiceAndWait,
    waitForVoiceToFinish,
    playIntroWelcome,
    prefetchStaticAudio,
  };
}
