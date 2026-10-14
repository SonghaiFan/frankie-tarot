import { completeReadingContext } from './readingContext';
import type { TarotReadingRequest } from './tarotHost';

/** The original poetic reading and deeper follow-up, combined for an external AI. */
export function buildTarotReadingPrompt(
  reading: TarotReadingRequest & { readingText?: string },
): string {
  const context = completeReadingContext(reading);
  const english = reading.locale === 'en';
  const cards = context.cards.map(card => english
    ? `${card.position}. ${card.positionLabel}: ${card.name} (${card.isReversed ? 'Reversed' : 'Upright'})\n   Core keywords: ${card.keywords.join(', ')}\n   Orientation-specific meaning hints: ${card.meaning ?? ''}`
    : `${card.position}. ${card.positionLabel}：${card.name}（${card.isReversed ? '逆位' : '正位'}）\n   核心关键词：${card.keywords.join('、')}\n   对应正逆位的牌义参考：${card.meaning ?? ''}`
  ).join('\n');
  const previous = reading.readingText?.trim();
  const profile = context.spread.interpretationProfile;
  if (profile) {
    const details = context.cards.map(card => {
      const orientation = card.isReversed ? 'reversed' : 'upright';
      const evidence = card.source?.pkt;
      const reference = evidence?.references[orientation];
      return [
        english
          ? `${card.position}. ${card.positionLabel}: ${card.name} (${card.isReversed ? 'Reversed' : 'Upright'})`
          : `${card.position}. ${card.positionLabel}：${card.name}（${card.isReversed ? '逆位' : '正位'}）`,
        `${english ? 'Project-curated keywords' : '项目编写的关键词'}: ${card.keywords.join(english ? ', ' : '、')}`,
        `${evidence ? (english ? 'PKT historical meaning' : 'PKT 历史牌义') : (english ? 'Saved meaning from this reading' : '这次牌局保存的牌义')}: ${card.meaning ?? ''}`,
        ...(!english && card.originalMeaning ? [`PKT English: ${card.originalMeaning}`] : []),
        ...(evidence && reference ? [`Source: ${evidence.title} (${evidence.edition}), ${reference.chapter}, L${reference.lineStart}–${reference.lineEnd}; ${evidence.url}; SHA-256 ${evidence.sha256}`] : []),
        ...(card.pktSymbolism ? [`PKT pictorial description: ${card.pktSymbolism.en}`] : []),
        ...(card.modernMeaning ? [`${english ? 'Project-curated modern extension (not a Waite quotation)' : '项目编写的现代扩展（非 Waite 原话）'}: ${card.modernMeaning}`] : []),
      ].join('\n   ');
    }).join('\n');
    const source = context.spread.source;
    const replacements: Record<string, string> = {
      spreadName: context.spread.name,
      question: context.question.trim() || (english ? 'General guidance for the path ahead.' : '综合指引，探索前路。'),
      spreadInstructions: context.spread.interpretationInstruction,
      cards: details,
      previousInterpretation: previous ? `${english ? 'Existing interpretation for this same reading' : '同一次牌局已有的解读'}:\n${previous}` : '',
      sourceContext: source
        ? `${source.label}\n${source.references.map(r => `PKT ${r.chapter}, L${r.lineStart}–${r.lineEnd}`).join('\n')}\nDataset: ${context.spread.datasetVersion ?? 'unversioned'}; profile: ${profile.id}`
        : (english ? 'This table has no independently attributed spread source.' : '这次牌局没有独立核实的牌阵来源。'),
    };
    // Substitute only template tokens once: user text is data, never another template.
    return profile.templates[reading.locale].replace(/\{\{(\w+)\}\}/g, (token, key: string) => replacements[key] ?? token);
  }
  // Compatibility for snapshots/catalogs created before the API supplied templates.

  if (english) return `Role: You are a Grand Tarot Master and ancient sage. Your voice is poetic, emotionally intelligent, and grounded rather than theatrical. Interpret how the positions and cards interact, rather than listing dictionary meanings.

Task: Interpret this exact reading in English. Use only the supplied cards, their positions and orientations. Do not draw again, invent additional cards, or make certain predictions. Treat tarot as reflection and possible directions, not fixed fate.

Spread: ${context.spread.name}
Seeker's question: ${context.question.trim() || 'General guidance for the path ahead.'}

Personal context:
You are being opened in the seeker's usual AI assistant. When relevant, draw on what you already know about the person asking—their goals, recent circumstances, preferences, values and recurring patterns—from available conversation context or memory. Use that understanding to connect both the poetic reading and detailed analysis to their life, and make the practical advice fit their situation. Treat the person asking as the seeker unless they explicitly say they are asking for someone else. Use only information you actually have; do not invent personal history or imply access to unavailable memories. Treat older context as potentially outdated, distinguish known facts from interpretations, and ask a brief clarifying question when a missing detail would materially change the reading. Avoid bringing up unrelated sensitive details.

Spread-specific interpretation rules:
${context.spread.interpretationInstruction}

Cards drawn, in their actual spread order:
${cards}${previous ? `\n\nExisting interpretation for this same reading:\n${previous}\nBuild on this context consistently while allowing a more nuanced interpretation.` : ''}

Respond in this order:

1. Poetic reading
Write one cohesive paragraph of 130–180 words. Speak directly to “you”. Weave the whole spread into a fluid story connected to the question; do not use bullets or card-by-card numbering in this section. End with a short empowering line or mantra, without a label.

2. Detailed analysis
Then give a deeper, more detailed analysis, organized around this spread's structure and interpretation rules. Explain the central theme, relationships and tensions between positions, and the connections between cards. Support your reasoning with specific cards and positions. For a timeline or yearly spread, connect the periods and identify key transitions; for a decision or relationship spread, examine the relevant options or perspectives. Discuss hidden influences and offer concrete, realistic next steps linked to the question. Clear headings or bullets are welcome here; this section is not subject to the poetic paragraph's word limit.

Interpretation guidelines:
- Upright energy can be active, direct or clearly manifest.
- Reversed does not automatically mean bad: consider blockage, delay, inner conflict, internalization or excess, in context.
- Use the supplied meanings as reference, not as a script. Avoid generic textbook lists and unsupported claims.
- Mention elemental harmony or tension only when it helps explain this reading.
- Keep both sections coherent with the same cards and question. Start with the poetic reading, then continue into the detailed analysis.`;

  return `角色：你是一位博学的塔罗解读者与古老智慧的讲述者。语气诗意、富有情感洞察，同时落在现实生活中，避免戏剧化。通过牌位与牌之间的相互作用解读整个牌阵，而不是逐张罗列字典牌义。

任务：用简体中文解读这同一次牌局。只使用下面已经抽取并翻开的牌、实际牌位与正逆位；不要重新抽牌、补牌或杜撰其他牌，不作确定性预测。将塔罗作为反思与可能方向的启示，而不是固定命运。

牌阵：${context.spread.name}
问题：${context.question.trim() || '综合指引，探索前路。'}

结合你对发问人的了解：
这段提示词是在发问人平时使用的 AI 助手中打开的。解读时，如与你已掌握的对话上下文或记忆相关，请结合你对发问人的目标、近期处境、偏好、价值观和长期行为模式的了解，让诗意解读、详细分析与现实建议更贴近这个人。除非明确说明是在替别人提问，否则将发问人视为这次解读的对象。只使用你真实已有的信息，不编造个人经历，也不暗示你能读取不可用的记忆；较早的背景可能已经变化，要区分已知事实与解读推测。若缺少会实质影响解读的关键信息，可以简短提问确认。不要牵入与本次问题无关的敏感细节。

此牌阵的专属解读规则：
${context.spread.interpretationInstruction}

抽到的牌（按实际牌位顺序）：
${cards}${previous ? `\n\n同一次牌局已有的解读：\n${previous}\n在这个上下文上继续深化，保持整体连贯，也允许提出更细致的理解。` : ''}

请严格按以下顺序输出：

一、诗意解读
先写一段约 120–180 个中文字的完整段落，直接称呼“你”。结合问题，把整副牌编织成连贯、流动的故事或讯息；这一部分不要项目符号，也不要逐张编号解释。用一句简短、有力量的寄语收尾，不给寄语另加标签。

二、详细分析
接着给出更深入、更细致的分析，按当前牌阵的结构与专属解读规则组织内容。解释整体主题、不同牌位之间的联系与张力，以及牌与牌之间的隐藏联系，并用具体牌名与牌位支撑判断。时间线或年度牌阵要串联各阶段、指出关键转折；决策或关系牌阵要分析对应选项或双方视角。关注潜在影响因素，结合问题给出具体可行的现实建议与下一步行动。这里可以使用清晰的小标题或列表，不受前面诗意段落的字数限制。

解读原则：
- 正位可表示活跃、直接或已显现的能量。
- 逆位不自动等于坏结果；结合语境考虑受阻、延迟、内在冲突、内化或过度。
- 牌义参考用于辅助理解，不照抄成通用教材式清单，不作没有依据的断言。
- 只有在有助于理解时才提及元素间的协调与冲突。
- 两部分始终围绕同一组牌和同一个问题，先诗意解读，再进入详细分析。`;
}
