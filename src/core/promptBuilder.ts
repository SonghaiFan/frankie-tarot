import { getLocalizedSpread } from "@/features/tarot/constants/spreads";
import { SpreadType, PickedCard, Locale } from "@/features/tarot/types";

export interface TarotReadingPromptOptions {
  cards: PickedCard[];
  spread: SpreadType;
  question: string;
  locale?: Locale;
}

export interface TarotFollowUpPromptOptions {
  cards: PickedCard[];
  spread: SpreadType;
  question: string;
  readingText: string;
  locale?: Locale;
}

/**
 * 组装给外部大模型（如 ChatGPT / OpenAI / Claude）的主解读 System + User Prompt
 */
export function buildTarotReadingPrompt({
  cards,
  spread,
  question,
  locale = "zh-CN",
}: TarotReadingPromptOptions): string {
  const spreadConfig = getLocalizedSpread(spread, "en");
  const isEn = locale === "en";
  const outputLanguage = isEn ? "English" : "Simplified Chinese";

  const cardDetails = cards
    .map((c, i) => {
      let position = `Position ${i + 1}`;
      if (spreadConfig.layoutType === "absolute" && spreadConfig.positions) {
        position = spreadConfig.positions[i]?.label || position;
      } else if (spreadConfig.labels) {
        position = spreadConfig.labels[i] || position;
      }

      const meaningHints = isEn
        ? c.descriptionEn || c.descriptionCn || ""
        : (c.isReversed ? c.negative : c.positive) ||
          c.descriptionCn ||
          c.descriptionEn ||
          "";

      const orientation = c.isReversed ? "REVERSED" : "UPRIGHT";
      const title = isEn ? c.nameEn : c.nameCn;

      const keywordLine = isEn
        ? `\n        - Core Keywords: ${(c.keywordsEn || []).join(", ")}`
        : `\n        - Core Keywords: ${c.keywords.join("、")}`;

      return `Card ${i + 1} [${position}]: ${title}
        - Orientation: ${orientation}${keywordLine}
        ${meaningHints ? `- Meaning Hints: ${meaningHints}` : ""}`;
    })
    .join("\n");

  const spreadContext = spreadConfig.interpretationInstruction;
  const userQuestion = question && question.trim()
    ? `Seeker's Question: "${question.trim()}"`
    : "Seeker's Question: General guidance for the path ahead.";

  return `
Role: You are a Grand Tarot Master and ancient sage.
Your voice is mystical, emotionally intelligent, and grounded rather than theatrical.
You interpret spreads by how the card positions interact, not by listing separate dictionary meanings.

Task: Provide a Tarot reading for the seeker based on the following details.

Spread: ${spreadConfig.name}
${userQuestion}

${spreadContext}

Cards Drawn:
${cardDetails}

Strict Interpretation Guidelines:
1. Upright vs. Reversed:
   - Upright means energy that is active, direct, or clearly manifest.
   - Reversed does NOT automatically mean bad. It may indicate blocked energy, delay, inner conflict, internalization, or excess.

2. Context:
   - Connect the reading directly to the seeker's specific question.
   - Avoid generic textbook meanings.

3. Narrative Flow & Synthesis:
   - Do not list cards one by one like a dictionary.
   - Weave them into a single, fluid story or message.
   - Mention elemental harmony or tension only if it naturally helps the reading.

4. Tone & Format:
   - Output language: ${outputLanguage}.
   - Format: One cohesive paragraph. No bullet points. No card-by-card numbering.
   - Speak directly to "you" if the output language is English, or directly to "你" if the output language is Simplified Chinese.
   - End with a short empowering line or mantra, without a label.
   - Length: ${isEn ? "130-180 words" : "120-180 Chinese characters"}.

Start your interpretation immediately in ${outputLanguage}.
`.trim();
}

/**
 * 组装便于问卜者或第三方 Agent 进行多轮深挖/追问的结构化上下文 Prompt
 */
export function buildTarotFollowUpPrompt({
  cards,
  spread,
  question,
  readingText,
  locale = "zh-CN",
}: TarotFollowUpPromptOptions): string {
  const isEn = locale === "en";
  const spreadConfig = getLocalizedSpread(spread, locale);

  const cardsList = cards
    .slice(0, spreadConfig.cardCount)
    .map((card, index) => {
      const positionLabel =
        spreadConfig.layoutType === "absolute"
          ? spreadConfig.positions?.[index]?.label
          : spreadConfig.labels?.[index];

      const localizedKeywords = isEn ? card.keywordsEn || [] : card.keywords;
      const keywordText =
        localizedKeywords.length > 0 ? ` - ${localizedKeywords.join(", ")}` : "";

      const orientation = isEn
        ? card.isReversed
          ? "Reversed"
          : "Upright"
        : card.isReversed
          ? "逆位"
          : "正位";

      const cardName = isEn ? card.nameEn : card.nameCn;
      const fallbackPos = isEn ? "Card" : "卡牌";

      return `${index + 1}. ${positionLabel || fallbackPos}: ${cardName} (${orientation})${keywordText}`;
    })
    .join("\n");

  if (isEn) {
    const qText = question && question.trim() ? question.trim() : "General guidance";
    return `I did a tarot reading using the "${spreadConfig.name}" spread.

Question: ${qText}

Cards Drawn:
${cardsList}

Initial Interpretation:
${readingText}

Please give a deeper and more detailed analysis of this reading, focusing on hidden connections between the cards and practical advice.`.trim();
  }

  const qText = question && question.trim() ? question.trim() : "综合指引";
  return `我使用「${spreadConfig.name}」牌阵完成了一次塔罗解读。

问题：${qText}

抽到的牌：
${cardsList}

当前解读：
${readingText}

请基于这些内容，继续给出更深入、更细致的分析，重点关注牌与牌之间的隐藏联系，以及可执行的现实建议。`.trim();
}
