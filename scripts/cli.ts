#!/usr/bin/env tsx
import {
  runTarotPipeline,
  listAvailableSpreads,
  SpreadType,
  Locale,
} from "../src/core";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🔮 Mystic Tarot CLI - Headless Tarot Spread & Prompt Tool

用法:
  npx tsx scripts/cli.ts [问题] [选项]

选项:
  --spread <ID>      指定牌阵 (例如: SINGLE, THREE, FOUR, TIMELINE, RELATION, CELTIC 等，默认 AUTO)
  --locale <LANG>    语言设置 (zh-CN 或 en，默认 zh-CN)
  --json             以完整 JSON 格式输出结果
  --list-spreads     列出所有支持的牌阵列表
  -h, --help         显示帮助信息

示例:
  npx tsx scripts/cli.ts "我下半年的事业发展趋势如何？"
  npx tsx scripts/cli.ts "我们要不要开始合作？" --spread RELATION
  npx tsx scripts/cli.ts "How will my next project go?" --locale en --json
    `);
    process.exit(0);
  }

  if (args.includes("--list-spreads")) {
    const isEn = args.includes("en");
    const spreads = listAvailableSpreads(isEn ? "en" : "zh-CN");
    console.log("\n📋 支持的牌阵列表：\n");
    spreads.forEach((s) => {
      console.log(`  • [${s.id}] ${s.name} (${s.cardCount} 张牌) - ${s.description}`);
    });
    console.log("");
    process.exit(0);
  }

  // Parse arguments
  let spreadArg: SpreadType | "AUTO" = "AUTO";
  let localeArg: Locale = "zh-CN";
  let isJson = false;
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--spread" && args[i + 1]) {
      spreadArg = args[++i].toUpperCase() as SpreadType;
    } else if (arg === "--locale" && args[i + 1]) {
      localeArg = args[++i] as Locale;
    } else if (arg === "--json") {
      isJson = true;
    } else if (!arg.startsWith("--")) {
      positionalArgs.push(arg);
    }
  }

  const question = positionalArgs.join(" ").trim() || "综合指引与启示";

  if (!isJson) {
    console.log(`\n🌌 正在为问题「${question}」进行塔罗推演...\n`);
  }

  const result = await runTarotPipeline({
    question,
    spread: spreadArg,
    locale: localeArg,
  });

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✨ 牌阵: ${result.spread.name} (${result.spread.id})`);
  console.log(`📖 描述: ${result.spread.description}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎴 抽取的卡牌:`);
  result.cards.forEach(({ positionIndex, positionLabel, card }) => {
    const orientation = card.isReversed ? "【逆位】" : "【正位】";
    const keywords = (localeArg === "en" ? card.keywordsEn : card.keywords) || [];
    const name = localeArg === "en" ? card.nameEn : card.nameCn;
    console.log(
      `  [${positionIndex}] ${positionLabel} ──► ${name} ${orientation} (${keywords.slice(0, 3).join(", ")})`
    );
  });
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  console.log(`📜 生成的 Reading Prompt:`);
  console.log(`\n${result.prompts.readingPrompt}\n`);
}

main().catch((err) => {
  console.error("Tarot CLI Error:", err);
  process.exit(1);
});
