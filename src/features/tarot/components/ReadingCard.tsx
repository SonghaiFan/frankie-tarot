import { useCardFrame } from '../hooks/useCardFrame';
import type { CardBackId } from '../constants/cardBacks';
import { CARD_BORDER_RADIUS } from '../constants/cardDimensions';
import React from 'react';
import FrankSignature from '@/app/components/FrankSignature';
import { getCardImageUrl } from '../constants/cards';
import { getLocalizedSpread } from '../constants/spreads';
import type { PickedCard, SpreadType, Locale, CardFaceStyle } from '../types';

/** The shared reading composition for PNG export on the website and in MCP hosts. */
export interface ReadingCardProps {
  question: string; spread: SpreadType; pickedCards: PickedCard[];
  readingText: string; locale: Locale; cardFaceStyle?: CardFaceStyle;
  cardBackId?: CardBackId;
  onCardClick?: (position: number) => void;
}

/** Fixed desktop canvas: the export is a landscape poster, never a phone column. */
export const READING_CARD_WIDTH = 1600;

const SERIF = '"Noto Serif SC", "Songti SC", Georgia, serif';
const DISPLAY = 'Cinzel, "Noto Serif SC", Georgia, serif';
const INK = '#f0ede8';
const MUTED = 'rgba(240,237,232,0.52)';
const FAINT = 'rgba(240,237,232,0.38)';
const HAIRLINE = 'rgba(255,255,255,0.09)';

// Deterministic star field so every export of the same reading looks the same.
const STARS = (() => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dots = Array.from({length: 90}, () =>
    `<circle cx="${(rand() * 800).toFixed(1)}" cy="${(rand() * 600).toFixed(1)}" r="${(rand() * 0.9 + 0.25).toFixed(2)}" fill="#fff" fill-opacity="${(rand() * 0.45 + 0.08).toFixed(2)}"/>`).join('');
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">${dots}</svg>`)}")`;
})();

const eyebrow: React.CSSProperties = {fontFamily:DISPLAY,fontSize:12,letterSpacing:'0.38em',textTransform:'uppercase',color:FAINT};

const pad2 = (n: number) => String(n).padStart(2, '0');

function renderEmphasis(text: string) {
  return text.split('**').map((part, i) => i % 2 ? <strong key={i} style={{fontWeight:600,color:INK}}>{part}</strong> : part);
}

function columnsFor(count: number, maxPerRow: number) {
  return Math.ceil(count / Math.ceil(count / maxPerRow));
}

export default function ReadingCard({question,spread,pickedCards,readingText,locale,cardFaceStyle='dreamy',cardBackId,onCardClick}:ReadingCardProps) {
  const frame = useCardFrame(cardBackId ?? (cardFaceStyle === 'dreamy' ? 'eclipse-nocturne' : cardFaceStyle === 'original' ? 'thorn-bloom' : 'celestial-compass'));
  const config = getLocalizedSpread(spread,locale);
  const zh = locale === 'zh-CN';
  const hasReading = !!readingText.trim();
  const count = pickedCards.length;
  const columns = columnsFor(count, hasReading ? 5 : 6);
  const roomy = columns <= 5;
  const cardMaxWidth = count === 1 ? (hasReading ? 320 : 340) : hasReading ? 230 : 280;
  const date = new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', {year:'numeric',month:'long',day:'numeric'}).format(new Date());
  const paragraphs = readingText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  const cards = <div style={{display:'grid',gridTemplateColumns:`repeat(${columns}, minmax(0, ${cardMaxWidth}px))`,justifyContent:'center',columnGap:count > 5 ? 28 : 40,rowGap:48}}>
    {pickedCards.map((card,index)=>{
      const name = zh ? card.nameCn : card.nameEn;
      // Position labels may carry their own "1." numbering; the poster numbers cards itself.
      const label = (config.positions?.[index]?.label ?? config.labels?.[index])?.replace(/^\s*\d+\s*[.、:：]\s*/, '');
      const keywords = (zh ? card.keywords : card.keywordsEn ?? card.keywords)?.slice(0, 3);
      return <figure key={card.id} style={{margin:0,minWidth:0,textAlign:'center'}}>
        <div style={{...eyebrow,fontSize:11,letterSpacing:'0.28em',marginBottom:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          <span style={{color:MUTED}}>{pad2(index + 1)}</span>{label && <> · {label}</>}
        </div>
        <button type="button" disabled={!onCardClick} onClick={()=>onCardClick?.(index+1)} aria-label={`${zh ? '讨论' : 'Discuss'} ${name}`} style={{display:'block',border:0,background:'none',padding:0,width:'100%',cursor:onCardClick?'pointer':'default'}}>
          <div style={{padding:frame.padding,borderRadius:CARD_BORDER_RADIUS,background:'#fff',boxShadow:'0 30px 60px -20px rgba(0,0,0,0.85), 0 0 48px rgba(150,140,255,0.07)'}}>
            <img crossOrigin="anonymous" src={getCardImageUrl(card.image,cardFaceStyle)} alt={name} style={{display:'block',width:'100%',aspectRatio:'2 / 3.4',objectFit:'cover',borderRadius:frame.innerRadius,transform:card.isReversed?'rotate(180deg)':undefined}} />
          </div>
        </button>
        <figcaption style={{marginTop:18}}>
          <div style={{fontSize:roomy ? 19 : 16,color:INK,letterSpacing:zh ? '0.12em' : '0.02em',lineHeight:1.4,overflowWrap:'anywhere'}}>{name}</div>
          <div style={{...eyebrow,fontSize:10,letterSpacing:'0.32em',marginTop:8,color:card.isReversed ? 'rgba(214,190,255,0.62)' : FAINT}}>
            {card.isReversed ? (zh ? '逆位' : 'Reversed') : (zh ? '正位' : 'Upright')}
          </div>
          {roomy && keywords?.length ? <div style={{fontSize:13,color:MUTED,marginTop:12,lineHeight:1.7,fontWeight:300}}>{keywords.join(' · ')}</div> : null}
        </figcaption>
      </figure>;
    })}
  </div>;

  const questionBlock = <div style={{textAlign:hasReading ? 'left' : 'center'}}>
    <div style={eyebrow}>{zh ? '你的问题 · Question' : 'Your question'}</div>
    <h2 style={{margin:'18px 0 0',fontSize:question.length > 40 ? 28 : 34,fontWeight:300,lineHeight:1.55,color:INK,letterSpacing:zh ? '0.06em' : '0.01em',overflowWrap:'anywhere'}}>
      {question || (zh ? '此刻，向内倾听' : 'A moment of listening inward')}
    </h2>
  </div>;

  return <article aria-label={zh ? '塔罗结果' : 'Tarot reading'} style={{position:'relative',width:READING_CARD_WIDTH,boxSizing:'border-box',padding:'64px 88px 56px',color:INK,fontFamily:SERIF,overflow:'hidden',
    background:`radial-gradient(ellipse 60% 50% at 18% 0%, rgba(110,96,190,0.16), transparent 70%), radial-gradient(ellipse 55% 45% at 92% 100%, rgba(60,110,170,0.12), transparent 70%), ${STARS} 0 0 / 800px 600px repeat, #030308`}}>
    <div aria-hidden="true" style={{position:'absolute',inset:22,border:`1px solid ${HAIRLINE}`,borderRadius:6,pointerEvents:'none'}} />

    <header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',paddingBottom:26,borderBottom:`1px solid ${HAIRLINE}`}}>
      <div style={{display:'flex',alignItems:'center',gap:14,color:'rgba(255,255,255,0.86)'}}>
        <FrankSignature className="h-8 w-auto" />
        <span style={{fontFamily:DISPLAY,fontSize:15,fontWeight:700,letterSpacing:'0.42em'}}>TAROT</span>
      </div>
      <div style={{textAlign:'right'}}>
        <div style={{fontSize:16,letterSpacing:zh ? '0.24em' : '0.08em',color:INK}}>{config.name}</div>
        <div style={{...eyebrow,fontSize:10,marginTop:8,whiteSpace:'nowrap'}}>{date}</div>
      </div>
    </header>

    {hasReading ? <main style={{display:'grid',gridTemplateColumns:'minmax(0, 1.12fr) minmax(0, 1fr)',gap:80,padding:'56px 0 60px'}}>
      <section style={{display:'flex',flexDirection:'column',gap:52}}>{questionBlock}{cards}</section>
      <section style={{borderLeft:`1px solid ${HAIRLINE}`,paddingLeft:72}}>
        <div style={eyebrow}>{zh ? '解读 · Interpretation' : 'Interpretation'}</div>
        <div style={{width:40,height:1,background:'rgba(255,255,255,0.25)',margin:'22px 0 30px'}} />
        {paragraphs.map((p,i)=><p key={i} style={{margin:'0 0 22px',fontSize:18,lineHeight:2,fontWeight:300,color:'rgba(240,237,232,0.82)',whiteSpace:'pre-wrap',overflowWrap:'anywhere',letterSpacing:zh ? '0.04em' : '0.005em'}}>{renderEmphasis(p)}</p>)}
      </section>
    </main> : <main style={{display:'flex',flexDirection:'column',gap:60,padding:'64px 0 68px'}}>{questionBlock}{cards}</main>}

    <footer style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:24,borderTop:`1px solid ${HAIRLINE}`}}>
      <span style={{fontSize:13,letterSpacing:'0.24em',color:MUTED,fontWeight:300}}>{zh ? '留一点时间，给自己' : 'A moment for yourself'}</span>
      <span style={{...eyebrow,fontSize:10}}>{zh ? '供自我探索 · For reflection' : 'For reflection only'}</span>
    </footer>
  </article>;
}
