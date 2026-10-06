import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_AURA_COLORS,
  DEFAULT_CARD_BACK_APPEARANCE,
  MAX_AURA_COLORS,
  getAuraColorChannels,
  normalizeCardBackAppearance,
} from "../src/features/tarot/services/cardBackAppearance";

test("the default palette preserves all eleven original shader color roles", () => {
  const channels = getAuraColorChannels(DEFAULT_AURA_COLORS);
  assert.equal(channels.length, 33);
  DEFAULT_AURA_COLORS.forEach((hex, index) => {
    [1, 3, 5].forEach((offset, component) => {
      assert.ok(Math.abs(channels[index * 3 + component] - parseInt(hex.slice(offset, offset + 2), 16) / 255) < 1e-7);
    });
  });
});

test("a two-color palette interpolates all shader roles without losing endpoints", () => {
  const channels = getAuraColorChannels(["#000000", "#ffffff"]);
  assert.deepEqual([...channels.slice(0, 3)], [0, 0, 0]);
  assert.deepEqual([...channels.slice(15, 18)], [0.5, 0.5, 0.5]);
  assert.deepEqual([...channels.slice(-3)], [1, 1, 1]);
});

test("saved settings round-trip and invalid palettes remain safe for the renderer", () => {
  const saved = { mode: "solid", solidColor: "#123abc", colors: ["#000000", "#ffffff"] };
  assert.deepEqual(normalizeCardBackAppearance(JSON.parse(JSON.stringify(saved))), saved);
  for (const invalid of [null, {}, { mode: "invalid", solidColor: "red", colors: ["#xyzxyz"] }, { colors: ["#ffffff"] }]) {
    assert.deepEqual(normalizeCardBackAppearance(invalid), DEFAULT_CARD_BACK_APPEARANCE);
  }
  const capped = normalizeCardBackAppearance({ colors: Array(100).fill("#abcdef") });
  assert.equal(capped.colors.length, MAX_AURA_COLORS);
  assert.ok([...getAuraColorChannels(capped.colors)].every(Number.isFinite));
});
