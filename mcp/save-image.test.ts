import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import type {App} from '@modelcontextprotocol/ext-apps';
import {saveReadingImage} from './ui/saveReadingImage';
const png={name:'Frank-Tarot-test.png',dataUrl:'data:image/png;base64,iVBORw0KGgo='};
const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
afterEach(()=>{if(previousWindow) Object.defineProperty(globalThis,'window',previousWindow);else delete (globalThis as any).window;});
function fileHost(openai:unknown){Object.defineProperty(globalThis,'window',{value:{openai},configurable:true});}
function app(capability:boolean,downloadFile?:App['downloadFile']){return {getHostCapabilities:()=>capability?{downloadFile:{}}:{},downloadFile} as App;}
test('PNG export reaches the host with its exact bytes and filename',async()=>{
  let request:any;
  const saved=await saveReadingImage(app(true,async params=>{request=params;return {};}),png);
  assert.equal(saved.destination,'download');
  assert.equal(request.contents[0].resource.blob,'iVBORw0KGgo=');
  assert.equal(request.contents[0].resource.uri,'file:///Frank-Tarot-test.png');
  assert.equal(request.contents[0].resource.mimeType,'image/png');
});
test('host download denial does not upload the file through another route',async()=>{
  fileHost({uploadFile:()=>{assert.fail('A denied download must not trigger an upload');}});
  await assert.rejects(saveReadingImage(app(true,async()=>({isError:true})),png),/not accepted/);
});
test('ChatGPT upload saves actual PNG bytes and exposes only the returned file ID',async()=>{
  let state:any;
  fileHost({uploadFile:async(file:File,options:unknown)=>{
    assert.equal(file.name,png.name);assert.equal(file.type,'image/png');
    assert.equal(Buffer.from(await file.arrayBuffer()).toString('base64'),'iVBORw0KGgo=');
    assert.deepEqual(options,{library:true});return {fileId:'file-test'};
  },setWidgetState:(value:unknown)=>{state=value;},getFileDownloadUrl:async()=>{throw new Error('temporary link unavailable');}});
  const saved=await saveReadingImage(app(false),png);
  assert.equal(saved.destination,'library');assert.equal(saved.downloadUrl,undefined);
  assert.deepEqual(state.imageIds,['file-test']);
});
test('unsupported host and non-PNG exports fail without claiming a saved result',async()=>{
  fileHost(undefined);
  await assert.rejects(saveReadingImage(app(false),png),/does not support image exports/);
  await assert.rejects(saveReadingImage(app(false),{...png,dataUrl:'data:text/plain,hi'}),/Expected a PNG/);
});
