// Shared week-boundary math for the quiz weekly cap and the weekly streak evaluator. Weeks run
// Monday 00:00 UTC through the following Monday 00:00 UTC (exclusive), computed purely from the
// clock so there is no scheduler or stored week-rollover state to keep in sync (see
// .claude/rules/context.md: no background jobs or queues).

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function getWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = (day + 6) % 7; // Monday -> 0, Tuesday -> 1, ..., Sunday -> 6
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d;
}

function getWeekEnd(weekStart) {
  return new Date(weekStart.getTime() + MS_PER_WEEK);
}

module.exports = { MS_PER_WEEK, getWeekStart, getWeekEnd };
