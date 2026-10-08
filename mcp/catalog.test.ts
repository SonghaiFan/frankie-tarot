import assert from 'node:assert/strict';
import test from 'node:test';
import { listSpreads, SPREAD_IDS, spreadSchema } from './catalog';

const counts=[1,3,3,4,5,5,5,10,11,7,15];

for (const locale of ['en','zh-CN'] as const) {
  test(`plugin adapter validates the independent core spread catalog in ${locale}`,async()=>{
    const spreads=await listSpreads(locale,async()=>({spreads:SPREAD_IDS.map((id,index)=>({id,name:`${id} spread`,description:'fixture',cardCount:counts[index],labels:Array.from({length:counts[index]},(_,position)=>`Position ${position+1}`)}))}));
    assert.equal(spreads.length,11);
    assert.deepEqual(spreads.map(spread=>spread.id),SPREAD_IDS);
    assert.ok(!SPREAD_IDS.includes('AUTO'));
    for (const spread of spreads) {
      assert.ok(spreadSchema.safeParse(spread).success);
      assert.equal(spread.labels.length,spread.cardCount);
      assert.ok(spread.labels.every(label=>label.trim()));
    }
  });
}
