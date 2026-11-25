import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://subs.test';
const version = '__SUBS_BUILD__';
function worker({stale=false,missingAsset=false}={}) {
  const state = {skipped:0,navigations:0,messages:[],requests:[]};
  const handlers = new Map(), stores = new Map([['subs-shell-v1',new Map()],['unrelated-cache',new Map()]]);
  const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const caches = {
    keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),
    async open(name) {
      if (!stores.has(name)) stores.set(name,new Map());
      const entries=stores.get(name);
      return {
        put:async(request,response)=>entries.set(key(request),response.clone()),
        match:async request=>entries.get(key(request))?.clone()
      };
    }
  };
  const client = {
    url:origin,visibilityState:'visible',
    postMessage:message=>state.messages.push(message),
    navigate:()=>{state.navigations++;return Promise.resolve();}
  };
  const self = {
    location:{origin},addEventListener:(event,handler)=>handlers.set(event,handler),
    skipWaiting:async()=>{state.skipped++;},
    clients:{claim:async()=>{},matchAll:async()=>[client]}
  };
  const fetch = async(url,options)=>{
    url=new URL(url.url || url,origin);
    state.requests.push({url,options});
    if (url.pathname === '/') return new Response(`<head><meta name="subs-build" content="${stale?'old':version}"><script src="/assets/app.js"></script><link href="/assets/app.css"></head>`);
    if (missingAsset && url.pathname.endsWith('.css')) return new Response('',{status:404});
    return new Response(url.pathname);
  };
  runInNewContext(source,{self,caches,fetch,URL,Error});
  async function lifecycle(type) {
    let task;
    handlers.get(type)({waitUntil:promise=>{task=promise;}});
    await task;
  }
  async function request(path,mode='cors') {
    let task;
    handlers.get('fetch')({request:{url:new URL(path,origin).href,mode,method:'GET'},respondWith:promise=>{task=promise;}});
    return task;
  }
  return {state,stores,lifecycle,request};
}

test('fully caches one version before activation and serves its matching HTML and assets',async()=>{
  const w=worker();
  await w.lifecycle('install');
  assert.equal(w.state.skipped,1);
  assert.ok(w.state.requests.every(({url,options})=>url.searchParams.get('__subs_build')===version && options.cache==='no-store'));
  await w.lifecycle('activate');
  assert.equal(w.stores.has('subs-shell-v1'),false);
  assert.equal(w.stores.has('unrelated-cache'),true);
  const requests=w.state.requests.length;
  assert.match(await (await w.request('/','navigate')).text(),/subs-build/);
  assert.equal(await (await w.request('/assets/app.css')).text(),'/assets/app.css');
  assert.equal(w.state.requests.length,requests);
});

test('a stale CDN document or missing stylesheet cannot replace the working cache',async()=>{
  for (const options of [{stale:true},{missingAsset:true}]) {
    const w=worker(options);
    await assert.rejects(w.lifecycle('install'));
    assert.equal(w.state.skipped,0);
    assert.equal(w.stores.has('subs-shell-v1'),true);
  }
});

test('activation never force-navigates a legacy client that may have an unsaved draft',async()=>{
  const w=worker();
  await w.lifecycle('install');
  await w.lifecycle('activate');
  assert.equal(w.state.messages[0].type,'SUBS_UPDATE');
  assert.equal(w.state.navigations,0);
});
