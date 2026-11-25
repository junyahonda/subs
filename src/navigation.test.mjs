import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNavigation} from './navigation.mjs';

function browser() {
  const entries=[{external:true},null];
  let index=1,view,controller;
  const queued=[];
  const history={
    get state(){return entries[index];},
    replaceState(state){entries[index]=structuredClone(state);},
    pushState(state){entries.splice(++index,entries.length,structuredClone(state));},
    go(delta){queued.push(delta);}
  };
  const connect=()=>controller=createNavigation(history,next=>{view=next;});
  connect();
  const flush=()=>{while(queued.length){index+=queued.shift();controller.onPop(history.state);}};
  return {history,entries,connect,flush,get nav(){return controller;},get view(){return view;},get index(){return index;},get queued(){return queued.length;}};
}

test('Back closes Add, Edit, and Settings before reaching the previous site',()=>{
  for(const modal of [{type:'form'},{type:'form',id:'subscription-id'},{type:'settings'}]) {
    const b=browser();
    b.nav.setModal(modal);
    assert.equal(b.index,2);
    b.history.go(-1);b.flush();
    assert.deepEqual(b.view,{tab:'overview',modal:null});
    assert.equal(b.index,1);
    b.history.go(-1);b.flush();
    assert.equal(b.index,0,'Overview does not trap Back inside the app');
  }
});

test('Back from Reminders returns to Overview; a nested sheet closes first',()=>{
  const b=browser();
  b.nav.setTab('subscriptions');
  b.nav.setTab('reminders');
  assert.equal(b.index,2,'switching tabs replaces the secondary tab entry');
  b.nav.setModal({type:'form',id:'trial'});
  b.history.go(-1);b.flush();
  assert.deepEqual(b.view,{tab:'reminders',modal:null});
  b.history.go(-1);b.flush();
  assert.deepEqual(b.view,{tab:'overview',modal:null});
});

test('X, Escape, or save consumes the sheet entry only once',()=>{
  const b=browser();
  b.nav.setModal({type:'form'});
  b.nav.setModal(null);
  b.nav.setModal(null);
  assert.equal(b.queued,1);
  b.flush();
  assert.equal(b.index,1);
  assert.equal(b.view.modal,null);
  b.nav.setTab('overview');
  assert.equal(b.index,1,'selecting the current view does not add history');
});

test('Settings can close and navigate to Reminders without racing popstate',()=>{
  const b=browser();
  b.nav.setTab('subscriptions');
  b.nav.setModal({type:'settings'});
  b.nav.setModal(null);
  b.nav.setTab('reminders');
  b.flush();
  assert.deepEqual(b.view,{tab:'reminders',modal:null});
  assert.equal(b.index,2);
  b.history.go(-1);b.flush();
  assert.deepEqual(b.view,{tab:'overview',modal:null});
});

test('reload and Forward retain navigation IDs, without subscription data',()=>{
  const b=browser();
  b.nav.setTab('reminders');
  b.nav.setModal({type:'form',id:'plan-id'});
  b.connect();
  assert.deepEqual(b.view,{tab:'reminders',modal:{type:'form',id:'plan-id'}});
  b.history.go(-1);b.flush();
  b.history.go(1);b.flush();
  assert.deepEqual(b.view.modal,{type:'form',id:'plan-id'});
  assert.deepEqual(Object.keys(b.history.state),['subs.navigation.v1']);
});
