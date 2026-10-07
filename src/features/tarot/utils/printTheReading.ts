import type { CardBackId } from '../constants/cardBacks';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ReadingCard, { READING_CARD_WIDTH } from '../components/ReadingCard';
import type { SpreadType, PickedCard, Locale, CardFaceStyle } from '../types';
import type { ReadingImage } from '@/host/tarotHost';
import type { ReadingCardProps } from '../components/ReadingCard';

const FONT_TIMEOUT_MS = 5000;

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/**
 * Inline the app's Google fonts, subset to the glyphs on the poster, so the PNG
 * matches the app instead of system fallbacks. html-to-image cannot read the
 * cross-origin stylesheet itself; any failure (e.g. a host CSP) keeps fallbacks.
 */
async function buildFontEmbedCSS(text: string): Promise<string> {
  // Labels use text-transform, so the subset needs both letter cases.
  const glyphs = Array.from(new Set(text.toUpperCase() + text.toLowerCase() + text + '0123456789·')).join('');
  const families = ['Cinzel:wght@400;700', 'Noto+Serif+SC:wght@300;400;600'];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FONT_TIMEOUT_MS);
  try {
    const sheets = await Promise.all(families.map(async family => {
      const res = await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(glyphs)}`, {signal: controller.signal});
      if (!res.ok) throw new Error(`font css ${res.status}`);
      const css = await res.text();
      const urls = Array.from(new Set(Array.from(css.matchAll(/url\((https:[^)]+)\)/g), m => m[1])));
      const inlined = await Promise.all(urls.map(async url => [url, await blobToDataUrl(await (await fetch(url, {signal: controller.signal})).blob())] as const));
      return inlined.reduce((sheet, [url, data]) => sheet.split(url).join(data), css);
    }));
    return sheets.join('\n');
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/** Both website downloads and hosted exports render this exact composition. */
export async function renderReadingImage(props: ReadingCardProps): Promise<ReadingImage> {
    const {toPng} = await import('html-to-image');
    const container = document.createElement('div');
    container.style.cssText=`position:fixed;left:0;top:0;width:${READING_CARD_WIDTH}px;z-index:-1;pointer-events:none`;
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      flushSync(()=>root.render(React.createElement(ReadingCard,props)));
      const [fontEmbedCSS] = await Promise.all([
        buildFontEmbedCSS(container.textContent ?? ''),
        ...Array.from(container.querySelectorAll('img')).map(img=>img.decode()),
      ]);
      const dataUrl = await toPng(container,{pixelRatio:2,backgroundColor:'#030308',...(fontEmbedCSS ? {fontEmbedCSS} : {skipFonts:true})});
      return {name:`Frank-Tarot-${Date.now()}.png`,dataUrl};
    } finally {root.unmount();container.remove();}
}

export default function printTheReading(question:string,spread:SpreadType,pickedCards:PickedCard[],readingText:string,locale:Locale,cardFaceStyle?:CardFaceStyle,cardBackId?:CardBackId) {
  return async () => {
    const image=await renderReadingImage({question,spread,pickedCards,readingText,locale,cardFaceStyle,cardBackId});
    const link=document.createElement('a');
    link.download=image.name; link.href=image.dataUrl; link.click();
    return {destination:'download' as const,name:image.name};
  };
}
