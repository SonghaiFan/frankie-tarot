import assert from 'node:assert/strict';
import test from 'node:test';
import groundTruth from '../src/features/tarot/data/ground-truth.json';
import { listSpreads, SPREAD_IDS, spreadSchema } from './catalog';

for (const locale of ['en','zh-CN'] as const) {
  test(`smart-spread catalog preserves all real spreads and position labels in ${locale}`,()=>{
    const spreads=listSpreads(locale);
    assert.equal(spreads.length,11);
    assert.deepEqual(spreads.map(spread=>spread.id),SPREAD_IDS);
    assert.ok(!SPREAD_IDS.includes('AUTO'));
    for (const spread of spreads) {
      const original=groundTruth.spreads.byId[spread.id];
      assert.ok(spreadSchema.safeParse(spread).success);
      assert.equal(spread.name,original.name[locale]);
      assert.equal(spread.description,original.description[locale]);
      assert.equal(spread.cardCount,original.cardCount);
      assert.equal(spread.labels.length,spread.cardCount);
      assert.ok(spread.labels.every(label=>label.trim()));
    }
  });
}
