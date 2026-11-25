import test from 'node:test';
import assert from 'node:assert/strict';
import {nextDate,daysUntil,monthlyCost,readBackup,calendarFile,validDate,calendarReminder,googleCalendarLink,storeSubscriptions} from './model.mjs';
const subscription = (overrides={}) => ({id:'test-id',name:'Example',amount:12,currency:'USD',cycle:'monthly',date:'2026-01-31',status:'active',trial:false,category:'Entertainment',remind:3,notes:'',...overrides});
test('a stale tab cannot overwrite subscriptions added, edited, or deleted elsewhere',()=>{
 let raw=JSON.stringify({version:1,subscriptions:[]});
 const storage={getItem:()=>raw,setItem:(_key,value)=>{raw=value;}};
 const netflix=subscription({id:'netflix',name:'Netflix'}), spotify=subscription({id:'spotify',name:'Spotify'});
 assert.equal(storeSubscriptions(storage,[],[netflix]).saved,true);
 const conflict=storeSubscriptions(storage,[],[spotify]);
 assert.equal(conflict.saved,false);
 assert.deepEqual(readBackup(raw),[netflix]);
 assert.deepEqual(conflict.subscriptions,[netflix]);
 assert.equal(storeSubscriptions(storage,[netflix],[netflix,spotify]).saved,true);
 assert.equal(storeSubscriptions(storage,[netflix],[]).saved,false);
 assert.equal(readBackup(raw).length,2);
});
test('derived reminder fields do not create false stale-tab conflicts on later saves',()=>{
 const sub=subscription();let raw=JSON.stringify({version:1,subscriptions:[sub]});
 const storage={getItem:()=>raw,setItem:(_key,value)=>{raw=value;}};
 const first=storeSubscriptions(storage,[sub],[{...sub,amount:20,due:'2026-02-28'}]);
 assert.equal(first.saved,true);
 assert.equal('due' in first.subscriptions[0],false);
 assert.equal(storeSubscriptions(storage,first.subscriptions,[]).saved,true);
 assert.deepEqual(readBackup(raw),[]);
});
test('writes reject oversized lists without corrupting the existing list',()=>{
 const list=Array.from({length:2000},(_,id)=>subscription({id:String(id)}));
 let raw=JSON.stringify({version:1,subscriptions:list});
 const storage={getItem:()=>raw,setItem:(_key,value)=>{raw=value;}};
 assert.throws(()=>storeSubscriptions(storage,list,[...list,subscription({id:'overflow'})]));
 assert.equal(readBackup(raw).length,2000);
 assert.equal(storeSubscriptions(storage,list,list.slice(0,-1)).saved,true);
 assert.equal(readBackup(raw).length,1999);
});
test('renewals clamp month ends without drifting the billing anchor',()=>{
 assert.equal(nextDate(subscription(),'2026-02-01'),'2026-02-28');
 assert.equal(nextDate(subscription(),'2026-03-01'),'2026-03-31');
 assert.equal(nextDate(subscription({date:'2024-02-29',cycle:'yearly'}),'2025-02-01'),'2025-02-28');
 assert.equal(nextDate(subscription({date:'2024-02-29',cycle:'yearly'}),'2028-02-01'),'2028-02-29');
 assert.equal(nextDate(subscription({date:'2026-01-31',cycle:'quarterly'}),'2026-02-01'),'2026-04-30');
});
test('weekly and same-day renewals remain correct',()=>{
 assert.equal(nextDate(subscription({date:'2026-01-01',cycle:'weekly'}),'2026-01-09'),'2026-01-15');
 assert.equal(nextDate(subscription(),'2026-01-31'),'2026-01-31');
 assert.equal(daysUntil('2026-03-09','2026-03-07'),2);
});
test('unacknowledged trials stay visible after their date',()=>{assert.equal(nextDate(subscription({trial:true}),'2026-09-01'),'2026-01-31');});
test('totals normalize billing cycles, excluding trials and paused items',()=>{
 assert.equal(monthlyCost(subscription({amount:120,cycle:'yearly'})),10);
 assert.equal(monthlyCost(subscription({amount:3,cycle:'weekly'})),13);
 assert.equal(monthlyCost(subscription({amount:30,cycle:'quarterly'})),10);
 assert.equal(monthlyCost(subscription({trial:true})),0);
 assert.equal(monthlyCost(subscription({status:'paused'})),0);
});
test('backup import rejects malformed or hostile data without trusting it',()=>{
 const backup = subscriptions=>JSON.stringify({version:1,subscriptions});
 assert.equal(readBackup(backup([subscription()]))[0].name,'Example');
 for(const invalid of [subscription({date:'2026-02-30'}),subscription({amount:-5}),subscription({amount:'10'}),subscription({cycle:'toString'}),subscription({remind:-1}),subscription({name:''}),subscription({currency:'NOPE'})]) assert.throws(()=>readBackup(backup([invalid])));
 assert.throws(()=>readBackup(backup([subscription(),subscription()])));
 assert.equal(validDate('2024-02-29'),true);
 assert.equal(validDate('2026-02-29'),false);
});
test('backup billing cycles must be strings, not coercible arrays or objects',()=>{
 for(const cycle of [['weekly'],['monthly'],['yearly'],['quarterly'],{toString:'weekly'}]) {
   assert.throws(()=>readBackup(JSON.stringify({version:1,subscriptions:[subscription({cycle})]})));
 }
});
test('calendar reminders are before billing, escaped and exclude disabled entries',()=>{
 const ics=calendarFile([subscription({name:'Cloud, Plus;\nHello',date:'2026-06-10'}),subscription({id:'paused',status:'paused'}),subscription({id:'none',remind:0})],'2026-06-01',new Date('2026-06-01T10:00:00Z'));
 assert.match(ics,/DTSTART:20260607T/);
 assert.match(ics,/BEGIN:VALARM\r\nTRIGGER:PT0S/);
 assert.match(ics,/Cloud\\, Plus\\;\\nHello/);
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);
 assert.match(ics,/END:VCALENDAR\r\n$/);
 const late=calendarFile([subscription({trial:true,date:'2026-06-10'})],'2026-06-11',new Date('2026-06-11T20:03:00Z'));
 assert.match(late,/DTSTART:20260611T201800Z/);
});
test('urgent calendar imports always schedule a future alarm, including late night',()=>{
 for(const time of ['2026-11-25T20:03:00Z','2026-11-25T23:58:00Z']) {
   const now=new Date(time), sub=subscription({date:'2026-11-28'});
   const reminder=calendarReminder(sub,'2026-11-25',now);
   assert.equal(+reminder.start,+now+15*60000);
   const url=new URL(googleCalendarLink(sub,'2026-11-25',now));
   assert.equal(url.origin,'https://calendar.google.com');
   assert.equal(url.searchParams.get('action'),'TEMPLATE');
   assert.match(url.searchParams.get('dates'),/Z\/.*Z$/);
 }
});
