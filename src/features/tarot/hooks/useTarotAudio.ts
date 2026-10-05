import { useState, useRef, useCallback } from "react";
import { generateSpeech } from "@/features/tarot/services/gemini";
import { Locale } from "@/i18n/types";

const BACKGROUND_VOLUME = 0.06;

class SoundEngine {
  private ctx: AudioContext;
  private audioElement: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async startDrone() {
    if (this.audioElement) return; // Already playing

    try {
      const baseUrl = import.meta.env.BASE_URL;
      this.audioElement = new Audio(`${baseUrl}audio/background.mp3`);
      this.audioElement.crossOrigin = "anonymous";
      this.audioElement.loop = true;

      this.source = this.ctx.createMediaElementSource(this.audioElement);
      this.gain = this.ctx.createGain();

      this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.source.connect(this.gain);
      this.gain.connect(this.ctx.destination);

      await this.audioElement.play();

      this.gain.gain.linearRampToValueAtTime(
        BACKGROUND_VOLUME,
        this.ctx.currentTime + 5
      );
    } catch (error) {
      console.error("Background music playback failed:", error);
    }
  }

  stop() {
    if (!this.gain || !this.audioElement) return;

    const t = this.ctx.currentTime;
    this.gain.gain.linearRampToValueAtTime(0.001, t + 2);

    setTimeout(() => {
      this.audioElement?.pause();
      this.audioElement = null;
      this.source = null;
      this.gain = null;
    }, 2000);
  }
}

export interface StaticScripts {
  WELCOME: string;
  ASK: string;
  PICK: string;
  REVEAL: string;
}

export function useTarotAudio(locale: Locale, staticScripts: StaticScripts) {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEngineRef = useRef<SoundEngine | null>(null);
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
      soundEngineRef.current = new SoundEngine(ctx);
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
    async (
      text: string,
      cacheKey?: string,
      staticKey?: string
    ): Promise<void> => {
      if (!audioContextRef.current) return;

      const localeCacheKey = cacheKey ? `${locale}:${cacheKey}` : undefined;

      if (localeCacheKey && audioCacheRef.current.has(localeCacheKey)) {
        playBuffer(audioCacheRef.current.get(localeCacheKey)!);
        return;
      }

      try {
        const buffer = await generateSpeech(
          text,
          audioContextRef.current,
          staticKey,
          locale
        );
        if (buffer) {
          if (localeCacheKey) audioCacheRef.current.set(localeCacheKey, buffer);
          playBuffer(buffer);
        }
      } catch (err) {
        console.error("Voice generation exception", err);
      }
    },
    [locale, playBuffer]
  );

  const playVoiceAndWait = useCallback(
    async (
      text: string,
      cacheKey?: string,
      staticKey?: string
    ): Promise<void> => {
      if (!audioContextRef.current) return;

      const localeCacheKey = cacheKey ? `${locale}:${cacheKey}` : undefined;

      if (localeCacheKey && audioCacheRef.current.has(localeCacheKey)) {
        await playBufferAndWait(audioCacheRef.current.get(localeCacheKey)!);
        return;
      }

      try {
        const buffer = await generateSpeech(
          text,
          audioContextRef.current,
          staticKey,
          locale
        );
        if (buffer) {
          if (localeCacheKey) audioCacheRef.current.set(localeCacheKey, buffer);
          await playBufferAndWait(buffer);
        }
      } catch (err) {
        console.error("Voice generation exception", err);
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

      const selectedScript =
        selectedKey === "WELCOME" ? staticScripts.WELCOME : staticScripts.ASK;

      await playVoiceAndWait(
        selectedScript,
        selectedKey,
        selectedKey.toLowerCase()
      );
    })();

    await introWelcomePromiseRef.current;
  }, [initAudio, playVoiceAndWait, staticScripts.ASK, staticScripts.WELCOME]);

  const prefetchStaticAudio = useCallback(async () => {
    if (!audioContextRef.current) return;
    const scripts = [
      { k: "ASK", t: staticScripts.ASK },
      { k: "PICK", t: staticScripts.PICK },
      { k: "REVEAL", t: staticScripts.REVEAL },
    ];
    for (const s of scripts) {
      const cacheKey = `${locale}:${s.k}`;
      if (!audioCacheRef.current.has(cacheKey)) {
        generateSpeech(
          s.t,
          audioContextRef.current,
          s.k.toLowerCase(),
          locale
        )
          .then((buf) => {
            if (buf) audioCacheRef.current.set(cacheKey, buf);
          })
          .catch(() => {
            /* Ignore prefetch errors */
          });
      }
    }
  }, [locale, staticScripts]);

  const startDrone = useCallback(() => {
    soundEngineRef.current?.startDrone();
  }, []);

  const stopDrone = useCallback(() => {
    soundEngineRef.current?.stop();
  }, []);

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
    startDrone,
    stopDrone,
  };
}
