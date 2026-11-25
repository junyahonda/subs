import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startUpdates} from './updates.mjs';

const flush = () => new Promise(resolve=>setImmediate(resolve));
function browser({offline=false, failRegistration=false}={}) {
  const state = {version:'A',dialog:false,editing:false,reloads:0,checks:0,registrations:0,failRegistration};
  const document = Object.assign(new EventTarget(), {
    visibilityState:'visible',body:{},
    activeElement:{matches:()=>state.editing},
    querySelector:selector=>selector.startsWith('meta') ? {content:'A'} : state.dialog ? {} : null
  });
  const window = Object.assign(new EventTarget(), {
    location:{reload:()=>state.reloads++},
    setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(),clearTimeout,
    setInterval:fn=>{state.tick=fn;}
  });
  class MessageChannel {
    constructor() {
      this.port1 = {close(){}};
      this.port2 = {postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))};
    }
  }
  const serviceWorker = Object.assign(new EventTarget(), {
    controller:{postMessage:(_,ports)=>ports[0].postMessage({version:state.version})},
    async register(url,options) {
      state.registrations++;
      assert.equal(url,'/sw.js');
      assert.equal(options.updateViaCache,'none');
      if (state.failRegistration) throw new Error('network unavailable');
      return {update:async()=>{state.checks++;}};
    }
  });
  const navigator = {serviceWorker,onLine:!offline};
  class MutationObserver {constructor(fn){state.mutate=fn;} observe(){}}
  const emit = (target,type,data={})=>target.dispatchEvent(Object.assign(new Event(type),data));
  const announce = version => emit(serviceWorker,'message',{data:{type:'SUBS_UPDATE',version}});
  startUpdates({window,document,navigator,MutationObserver,MessageChannel});
  return {state,window,document,navigator,serviceWorker,emit,announce};
}

test('launch, warm resume, online and visible timer checks require no manual reload', async()=>{
  const b=browser();
  await flush();
  assert.equal(b.state.checks,1);
  b.document.visibilityState='hidden';
  b.emit(b.document,'visibilitychange');b.state.tick();
  await flush();
  assert.equal(b.state.checks,1);
  b.document.visibilityState='visible';
  b.emit(b.document,'visibilitychange');
  await flush();
  b.emit(b.window,'online');
  await flush();
  b.emit(b.window,'pageshow');
  await flush();
  b.state.tick();
  await flush();
  assert.equal(b.state.checks,5);
  assert.equal(b.state.reloads,0);
});

test('first install and unchanged version do not loop; a new controller refreshes once', async()=>{
  const b=browser();
  await flush();
  b.announce('A');
  assert.equal(b.state.reloads,0);
  b.state.version='B';
  b.emit(b.serviceWorker,'controllerchange');
  await flush();
  b.announce('B');b.state.mutate();
  assert.equal(b.state.reloads,1);
});

test('preserves an open sheet until it closes after receiving an update', async()=>{
  const b=browser();
  await flush();
  b.state.dialog=true;
  b.announce('B');
  b.state.mutate();
  assert.equal(b.state.reloads,0);
  b.state.dialog=false;
  b.state.mutate();
  assert.equal(b.state.reloads,1);
});

test('does not refresh in the background or offline; applies the pending update on return', async()=>{
  const b=browser();
  await flush();
  b.document.visibilityState='hidden';
  b.announce('B');
  b.document.visibilityState='visible';
  b.navigator.onLine=false;
  b.emit(b.document,'visibilitychange');
  assert.equal(b.state.reloads,0);
  b.navigator.onLine=true;
  b.emit(b.window,'online');
  assert.equal(b.state.reloads,1);
});

test('offline startup and transient registration failure retry after connectivity returns', async()=>{
  const b=browser({offline:true,failRegistration:true});
  await flush();
  assert.equal(b.state.registrations,0);
  b.navigator.onLine=true;
  b.emit(b.window,'online');
  await flush();
  assert.equal(b.state.registrations,1);
  b.state.failRegistration=false;
  b.emit(b.window,'focus');
  await flush();
  assert.equal(b.state.registrations,2);
  assert.equal(b.state.checks,1);
});

test('defers an automatic refresh while an input is focused', async()=>{
  const b=browser();
  await flush();
  b.state.editing=true;
  b.announce('B');
  assert.equal(b.state.reloads,0);
  b.state.editing=false;
  b.state.mutate();
  assert.equal(b.state.reloads,1);
});
