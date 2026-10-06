import { Locale } from "@/i18n/types";

// Load pre-generated MP3 audio from local file
export const loadLocalAudio = async (
  filename: string,
  audioContext: AudioContext
): Promise<AudioBuffer | null> => {
  try {
    const baseUrl = import.meta.env.BASE_URL;
    const response = await fetch(`${baseUrl}audio/${filename}`);
    if (!response.ok) {
      console.warn(`本地音频文件不存在: ${filename}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.warn(`加载本地音频失败: ${filename}`, error);
    return null;
  }
};

export const getStaticAudioFilename = (
  staticKey: string,
  locale: Locale
): string => (locale === "zh-CN" ? `${staticKey}_cn.mp3` : `${staticKey}.mp3`);

export const loadVoiceClip = (
  staticKey: string | undefined,
  audioContext: AudioContext,
  locale: Locale
): Promise<AudioBuffer | null> =>
  staticKey
    ? loadLocalAudio(getStaticAudioFilename(staticKey, locale), audioContext)
    : Promise.resolve(null);
