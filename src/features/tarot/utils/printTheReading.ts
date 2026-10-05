import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ReadingCard from '../components/ReadingCard';
import type { SpreadType, PickedCard, Locale, CardFaceStyle } from '../types';
import type { ReadingImage } from '@/host/tarotHost';
import type { ReadingCardProps } from '../components/ReadingCard';

/** Both website downloads and hosted exports render this exact composition. */
export async function renderReadingImage(props: ReadingCardProps): Promise<ReadingImage> {
    const {toPng} = await import('html-to-image');
    const container = document.createElement('div');
    container.style.cssText='position:fixed;left:0;top:0;width:1000px;z-index:-1;pointer-events:none';
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      flushSync(()=>root.render(React.createElement(ReadingCard,props)));
      await Promise.all(Array.from(container.querySelectorAll('img')).map(img=>img.decode()));
      const dataUrl = await toPng(container,{pixelRatio:2,backgroundColor:'#101110',skipFonts:true});
      return {name:`Frank-Tarot-${Date.now()}.png`,dataUrl};
    } finally {root.unmount();container.remove();}
}

export default function printTheReading(question:string,spread:SpreadType,pickedCards:PickedCard[],readingText:string,locale:Locale,cardFaceStyle?:CardFaceStyle) {
  return async () => {
    const image=await renderReadingImage({question,spread,pickedCards,readingText,locale,cardFaceStyle});
    const link=document.createElement('a');
    link.download=image.name; link.href=image.dataUrl; link.click();
    return {destination:'download' as const,name:image.name};
  };
}
