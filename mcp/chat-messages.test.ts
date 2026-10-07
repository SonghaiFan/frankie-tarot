import assert from 'node:assert/strict';
import test from 'node:test';
import { chatMessage } from './ui/chatMessages';

test('app-triggered chat messages contain only short user-facing requests', () => {
  for (const locale of ['zh-CN', 'en'] as const) {
    for (const action of ['select_spread', 'brief_summary', 'interpret'] as const) {
      const message = chatMessage(action, locale);
      assert.ok(message.length > 0 && message.length < 160);
      assert.doesNotMatch(message, /[{}]|flowId|readingId|open_tarot|list_tarot_spreads|Omit question|JSON/i);
    }
  }
});
