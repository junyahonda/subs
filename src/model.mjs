export const STORAGE_KEY = 'subs.v1';
export const CURRENCIES = ['USD', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'KRW', 'SGD'];
export const CATEGORIES = ['Entertainment', 'Music', 'Productivity', 'Health', 'Shopping', 'Cloud & storage', 'Other'];
export const CYCLES = { monthly: 'Monthly', yearly: 'Yearly', weekly: 'Weekly', quarterly: 'Quarterly' };
export function dateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(value) { return new Date(`${value}T12:00:00`); }
export function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(+parseDate(value)) && dateString(parseDate(value)) === value && value >= '2000-01-01' && value <= '2200-12-31'; }
export function daysUntil(value, today = dateString()) {
  const utc = s => { const [y,m,d] = s.split('-').map(Number); return Date.UTC(y,m-1,d); };
  return Math.round((utc(value) - utc(today)) / 86400000);
}
export function nextDate(sub, today = dateString()) {
  // Keep an unacknowledged trial date visible, even after it ends.
  if (sub.trial || sub.date >= today) return sub.date;
  const original = parseDate(sub.date);
  if (sub.cycle === 'weekly') {
    const next = parseDate(sub.date);
    next.setDate(next.getDate() + Math.ceil(-daysUntil(sub.date, today) / 7) * 7);
    return dateString(next);
  }
  const step = { monthly:1, quarterly:3, yearly:12 }[sub.cycle];
  const now = parseDate(today);
  const diff = (now.getFullYear()-original.getFullYear())*12+now.getMonth()-original.getMonth();
  let months = Math.max(0, Math.floor(diff/step)*step);
  for (;;) {
    const next = new Date(original.getFullYear(), original.getMonth()+months, 1, 12);
    next.setDate(Math.min(original.getDate(), new Date(next.getFullYear(), next.getMonth()+1,0).getDate()));
    if (dateString(next) >= today) return dateString(next);
    months += step;
  }
}
export function monthlyCost(sub) { return sub.status === 'paused' || sub.trial ? 0 : sub.amount * ({monthly:1, yearly:1/12, weekly:52/12, quarterly:1/3}[sub.cycle]); }
export function money(amount, currency = 'USD') { return new Intl.NumberFormat(undefined, {style:'currency',currency,maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2}).format(amount); }
export function prettyDate(value) { return parseDate(value).toLocaleDateString(undefined, {month:'short',day:'numeric',year:parseDate(value).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined}); }
export function relativeDate(value, today) { const days = daysUntil(value,today); return days < 0 ? `${-days}d overdue` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`; }
export function validateSub(s) {
  return s && typeof s.id === 'string' && s.id.length > 0 && s.id.length <= 100 && typeof s.name === 'string' && s.name.trim().length > 0 && s.name.length <= 80 && typeof s.amount === 'number' && Number.isFinite(s.amount) && s.amount >= 0 && s.amount <= 1000000000 && CURRENCIES.includes(s.currency) && Object.hasOwn(CYCLES,s.cycle) && validDate(s.date) && ['active','paused'].includes(s.status) && typeof s.trial === 'boolean' && CATEGORIES.includes(s.category) && [0,1,3,7,14,30].includes(s.remind) && typeof s.notes === 'string' && s.notes.length <= 1000;
}
export function readBackup(text) {
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || !Array.isArray(data.subscriptions) || data.subscriptions.length > 2000 || !data.subscriptions.every(validateSub) || new Set(data.subscriptions.map(s=>s.id)).size !== data.subscriptions.length) throw new Error('Choose a valid Subs backup file. Your current data has not changed.');
  return data.subscriptions.map(({id,name,amount,currency,cycle,date,status,trial,category,remind,notes}) => ({id,name:name.trim(),amount,currency,cycle,date,status,trial,category,remind,notes}));
}
const icsEscape = text => text.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const utcStamp = date => date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function calendarReminder(sub, today = dateString(), now = new Date()) {
  const due = nextDate(sub,today);
  const planned = parseDate(due);
  planned.setDate(planned.getDate()-sub.remind);
  planned.setHours(9,0,0,0);
  // A same-day 9 AM alarm may already have passed. Give urgent imports 15 minutes.
  const start = new Date(Math.max(+planned, +now + 15 * 60000));
  return {due, start, end:new Date(+start + 30 * 60000), title:`${sub.trial ? 'Trial ending' : 'Renewal coming'}: ${sub.name}`, description:`${sub.name} ${sub.trial ? 'trial ends' : 'renews'} on ${due} for ${money(sub.amount,sub.currency)}. Review or cancel with the provider before billing. This is a one-time reminder; export again after a renewal or edit.`};
}
export function googleCalendarLink(sub, today = dateString(), now = new Date()) {
  const event = calendarReminder(sub,today,now);
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({action:'TEMPLATE',text:event.title,dates:`${utcStamp(event.start)}/${utcStamp(event.end)}`,details:event.description})}`;
}
export function calendarFile(subs, today = dateString(), now = new Date()) {
  const events = subs.filter(s=>s.status==='active' && s.remind > 0).map(s => {
    const {due,start,end,title,description} = calendarReminder(s,today,now);
    return ['BEGIN:VEVENT', `UID:${s.id.replace(/[^a-zA-Z0-9-]/g,'')}-${due.replaceAll('-','')}@subs.junyahonda.com`, `DTSTAMP:${utcStamp(now)}`, `DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`, `SUMMARY:${icsEscape(title)}`, `DESCRIPTION:${icsEscape(description)}`, 'BEGIN:VALARM', 'TRIGGER:PT0S', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, 'END:VALARM', 'END:VEVENT'].join('\r\n');
  });
  // Fold by UTF-8 octets (RFC 5545), including long non-ASCII names.
  const fold = line => { let result='', length=0; for (const char of line) { const size = new TextEncoder().encode(char).length; if (length+size>73) { result+='\r\n '; length=1; } result+=char; length+=size; } return result; };
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Subs//Subscription reminders//EN','CALSCALE:GREGORIAN',...events,'END:VCALENDAR'].join('\r\n').split('\r\n').map(fold).join('\r\n')+'\r\n';
}
