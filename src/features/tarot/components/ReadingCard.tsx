import React from 'react';
import { getCardImageUrl } from '../constants/cards';
import { getLocalizedSpread } from '../constants/spreads';
import type { PickedCard, SpreadType, Locale, CardFaceStyle } from '../types';

/** One reading composition for image export and the ChatGPT inline result. */
export interface ReadingCardProps {
  question: string; spread: SpreadType; pickedCards: PickedCard[];
  readingText: string; locale: Locale; cardFaceStyle?: CardFaceStyle;
  onCardClick?: (position: number) => void;
}
export default function ReadingCard({question,spread,pickedCards,readingText,locale,cardFaceStyle='dreamy',onCardClick}:ReadingCardProps) {
  const config = getLocalizedSpread(spread,locale);
  const zh = locale === 'zh-CN';
  return <article aria-label={zh ? '塔罗结果' : 'Tarot reading'} style={{background:'#101110',color:'#e5e5e5',padding:'28px clamp(18px, 4vw, 44px)',fontFamily:'Georgia, "Noto Serif SC", serif',boxSizing:'border-box',width:'100%',border:'1px solid #30312e',borderRadius:16}}>
    <header style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'baseline',borderBottom:'1px solid #333',paddingBottom:18}}>
      <span style={{fontSize:18,letterSpacing:4}}>Frank TAROT</span>
      <span style={{fontSize:12,color:'#aaa'}}>{config.name}</span>
    </header>
    {question && <h2 style={{fontSize:20,fontWeight:400,lineHeight:1.7,margin:'24px 0',overflowWrap:'anywhere'}}>{question}</h2>}
    <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(3,pickedCards.length)}, minmax(0, 1fr))`,gap:18,margin:'24px auto',maxWidth:pickedCards.length===1 ? 240 : 720}}>
      {pickedCards.map((card,index)=><div key={card.id} style={{textAlign:'center',minWidth:0}}>
        <div style={{fontSize:11,color:'#aaa',marginBottom:10}}>{config.labels?.[index]}</div>
        <button type="button" disabled={!onCardClick} onClick={()=>onCardClick?.(index+1)} aria-label={`${zh ? '讨论' : 'Discuss'} ${locale==='en'?card.nameEn:card.nameCn}`} style={{border:0,background:'none',padding:0,width:'100%',cursor:onCardClick?'pointer':'default'}}>
          <img crossOrigin="anonymous" src={getCardImageUrl(card.image,cardFaceStyle)} alt={locale==='en'?card.nameEn:card.nameCn} style={{display:'block',width:'100%',aspectRatio:'2 / 3.4',objectFit:'cover',borderRadius:4,transform:card.isReversed?'rotate(180deg)':undefined}} />
        </button>
        <div style={{fontSize:13,marginTop:12}}>{locale==='en'?card.nameEn:card.nameCn}</div>
        <div style={{fontSize:11,color:'#aaa',marginTop:6}}>{card.isReversed?(zh?'逆位':'Reversed'):(zh?'正位':'Upright')}</div>
      </div>)}
    </div>
    {readingText && <p style={{fontSize:15,lineHeight:1.9,whiteSpace:'pre-wrap',overflowWrap:'anywhere',borderTop:'1px solid #333',paddingTop:20}}>{readingText}</p>}
    <footer style={{marginTop:24,fontSize:10,letterSpacing:2,color:'#999'}}>{zh?'留一点时间，给自己 · 供自我探索':'A moment for yourself · For reflection'}</footer>
  </article>;
}
