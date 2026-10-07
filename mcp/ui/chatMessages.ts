import type { Locale } from '@/features/tarot/types';

type ChatAction = 'select_spread' | 'brief_summary' | 'interpret';

/** ChatGPT displays sendMessage content as a user bubble. Keep it readable. */
export function chatMessage(action: ChatAction, locale: Locale): string {
  const messages = locale === 'zh-CN' ? {
    select_spread: '请根据我刚才在牌桌写的问题推荐合适的牌阵，让我自己选牌。',
    brief_summary: '请为刚刚翻开的牌写几句简短解读，并放回牌桌。',
    interpret: '请结合刚才的牌阵，深入看看牌与牌之间的联系，并给出具体可行的建议。',
  } : {
    select_spread: 'Please suggest a spread for the question I just entered in the table, then let me choose my cards.',
    brief_summary: 'Please write a short reflection on the cards I just revealed and add it to the table.',
    interpret: 'Please explore the connections between these cards more deeply and suggest practical next steps.',
  };
  return messages[action];
}
