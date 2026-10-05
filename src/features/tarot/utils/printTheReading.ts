import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ReadingCard from '../components/ReadingCard';
import type { SpreadType, PickedCard, Locale, CardFaceStyle } from '../types';

export default function printTheReading(question:string,spread:SpreadType,pickedCards:PickedCard[],readingText:string,locale:Locale,cardFaceStyle?:CardFaceStyle) {
  return async () => {
    const {toPng} = await import('html-to-image');
    const container = document.createElement('div');
    container.style.cssText='position:fixed;left:0;top:0;width:1000px;z-index:-1;pointer-events:none';
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      flushSync(()=>root.render(React.createElement(ReadingCard,{question,spread,pickedCards,readingText,locale,cardFaceStyle})));
      await Promise.all(Array.from(container.querySelectorAll('img')).map(img=>img.decode()));
      const dataUrl = await toPng(container,{pixelRatio:2,backgroundColor:'#101110',skipFonts:true});
      const link=document.createElement('a');
      link.download=`Frank-Tarot-${Date.now()}.png`; link.href=dataUrl; link.click();
    } finally {root.unmount();container.remove();}
  };
}
