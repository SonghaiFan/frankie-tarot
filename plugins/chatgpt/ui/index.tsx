import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App as McpApp } from "@modelcontextprotocol/ext-apps";
import OriginalApp from "@/app/App";
import { I18nProvider } from "@/i18n/I18nProvider";
import i18n from "@/i18n/config";
import { FULL_DECK } from "@/features/tarot/constants/cards";
import type { HostedReading, TarotHost } from "@/host/tarotHost";
import type { SpreadType } from "@/features/tarot/types";
import type { TarotPayload } from "../shared";
import "@/app/index.css";

const bridge = new McpApp({ name: "Frank Tarot", version: "0.2.0" }, {}, { autoResize: false });
let current: TarotPayload | undefined;
function payload(result: unknown): TarotPayload {
  const value = result as { isError?: boolean; structuredContent?: TarotPayload };
  if (value.isError || !value.structuredContent?.spreads) throw new Error("Tarot tool failed");
  return value.structuredContent;
}
function originalReading(value: TarotPayload): HostedReading {
  const reading = value.reading;
  if (!reading || !value.readingToken) throw new Error("Missing reading");
  return { id: reading.id, question: reading.question, spread: reading.spread.id as SpreadType,
    cards: reading.cards.map(card => {
      const original = FULL_DECK.find(item => item.id === card.id);
      if (!original) throw new Error("Unknown card");
      return { ...original, isReversed: card.isReversed };
    }),
  };
}
async function syncContext() {
  if (!current?.reading) return;
  await bridge.updateModelContext({ structuredContent: {
    readingId: current.reading.id, readingToken: current.readingToken,
    question: current.reading.question, spread: current.reading.spread,
    cards: current.reading.cards,
  } });
}
const host: TarotHost = {
  async expand() { if (bridge.getHostContext()?.availableDisplayModes?.includes("fullscreen")) await bridge.requestDisplayMode({mode:"fullscreen"}); },
  async draw(question, spread, locale) {
    current = payload(await bridge.callServerTool({ name: "draw_tarot_cards", arguments: { question, spread, locale } }));
    // A context failure must never cause a replacement draw. Retry it on explicit interpretation.
    void syncContext().catch(() => {});
    return originalReading(current);
  },
  async interpret(locale) {
    if (!current?.reading) throw new Error("No reading");
    await syncContext();
    const result = await bridge.sendMessage({ role: "user", content: [{ type: "text", text:
      (locale === "zh-CN" ? "请结合我的问题解读这一组已经抽好的牌，保持牌位和正逆位不变，以自我反思的方式一起讨论。" : "Explore this existing draw in relation to my question. Keep its cards, positions and orientations unchanged, and use a reflective tone.") + "\n" + JSON.stringify({ readingToken: current.readingToken, reading: current.reading })
    }] });
    if (result.isError) throw new Error("Host did not accept the message");
  },
};
function PluginRoot() {
  const [initialReading, setInitialReading] = useState<HostedReading>();
  const [error, setError] = useState("");
  useEffect(() => {
    bridge.ontoolresult = result => {
      try {
        const next = payload(result);
        current = next;
        void i18n.changeLanguage(next.locale);
        if (next.reading) setInitialReading(originalReading(next));
      } catch { setError("无法读取牌阵，请重新打开 Frank Tarot。"); }
    };
    void bridge.connect().then(async () => {
      const context = bridge.getHostContext();
      if (context?.availableDisplayModes?.includes("fullscreen") && context.displayMode !== "fullscreen") {
        await bridge.requestDisplayMode({ mode: "fullscreen" });
      }
    }).catch(() => setError("暂时无法连接对话，请重新打开 Frank Tarot。"));
    return () => { void bridge.close(); };
  }, []);
  return <I18nProvider><OriginalApp host={host} initialReading={initialReading} />
    {error && <div role="alert" className="fixed bottom-12 inset-x-4 z-[300] text-center text-red-200">{error}</div>}
  </I18nProvider>;
}
createRoot(document.getElementById("root")!).render(<PluginRoot />);
