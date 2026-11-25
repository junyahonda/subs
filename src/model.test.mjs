import test from 'node:test';
import assert from 'node:assert/strict';
import {nextDate,daysUntil,monthlyCost,readBackup,calendarFile,validDate} from './model.mjs';
const subscription = (overrides={}) => ({id:'test-id',name:'Example',amount:12,currency:'USD',cycle:'monthly',date:'2026-01-31',status:'active',trial:false,category:'Entertainment',remind:3,notes:'',...overrides});
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
test('calendar reminders are before billing, escaped and exclude disabled entries',()=>{
 const ics=calendarFile([subscription({name:'Cloud, Plus;\nHello',date:'2026-06-10'}),subscription({id:'paused',status:'paused'}),subscription({id:'none',remind:0})],'2026-06-01');
 assert.match(ics,/DTSTART;VALUE=DATE:20260607/);
 assert.match(ics,/BEGIN:VALARM\r\nTRIGGER:PT9H/);
 assert.match(ics,/Cloud\\, Plus\\;\\nHello/);
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);
 assert.match(ics,/END:VCALENDAR\r\n$/);
 const late=calendarFile([subscription({trial:true,date:'2026-06-10'})],'2026-06-11');
 assert.match(late,/DTSTART;VALUE=DATE:20260611/);
});
