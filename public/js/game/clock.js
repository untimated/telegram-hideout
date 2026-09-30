// Hideout time is one shared wall clock for every player, so NPC shifts, specials and the daily
// reset agree between clients and the server. Change the zone here to move the whole bar.
export const TIME_ZONE = 'Asia/Jakarta';

// A new Hideout day starts at 01:00: drunk and fuel reset and the daily coins arrive.
export const DAY_START_HOUR = 1;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
let formatter;

function parts(ms) {
  formatter ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'long',
  });
  const fields = {};
  for (const { type, value } of formatter.formatToParts(new Date(ms))) fields[type] = value;
  return fields;
}

// { hour, minute, weekday ('saturday'), date ('2026-09-30'), dayKey, hourKey } for a timestamp.
// dayKey names the Hideout day (which rolls over at DAY_START_HOUR, not midnight); hourKey
// changes on every wall-clock hour.
export function hideoutTime(ms = Date.now()) {
  const now = parts(ms);
  const shifted = parts(ms - DAY_START_HOUR * 3600_000);
  const date = `${now.year}-${now.month}-${now.day}`;
  return {
    hour: Number(now.hour),
    minute: Number(now.minute),
    weekday: now.weekday.toLowerCase(),
    weekdayIndex: WEEKDAYS.indexOf(now.weekday.toLowerCase()),
    date,
    dayKey: `${shifted.year}-${shifted.month}-${shifted.day}`,
    hourKey: `${date}T${now.hour}`,
  };
}

// True when `hour` (0-23, fractional allowed) falls in [from, to). `to` may be 24 or wrap past
// midnight (from 20 to 2).
export function withinHours(hour, from, to) {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

export function formatHour(hour) {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
}
