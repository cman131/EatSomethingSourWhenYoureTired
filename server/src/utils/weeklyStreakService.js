const User = require('../models/User');
const Game = require('../models/Game');
const PointTransaction = require('../models/PointTransaction');
const { recordAwardOnce } = require('./pointsLedger');
const { WEEKLY_STREAK_AMOUNTS } = require('./pointsConfig');
const { MS_PER_WEEK, getWeekStart, getWeekEnd } = require('./weekWindow');

async function hasVerifiedGameInWeek(userId, weekStart, weekEnd) {
  const game = await Game.exists({
    'players.player': userId,
    verified: true,
    verifiedAt: { $gte: weekStart, $lt: weekEnd },
  });
  return Boolean(game);
}

async function hasQuizCompletionInWeek(userId, weekStart, weekEnd) {
  const tx = await PointTransaction.exists({
    user: userId,
    type: 'quiz_completed',
    createdAt: { $gte: weekStart, $lt: weekEnd },
  });
  return Boolean(tx);
}

function wasActiveInWeek(user, weekStart, weekEnd) {
  return Boolean(user.lastActiveAt) && user.lastActiveAt >= weekStart && user.lastActiveAt < weekEnd;
}

// Walks backward week by week counting consecutive prior paid weeks, stopping once the escalation
// cap is reached (every further week pays the same capped amount) or a gap is found.
async function computeStreakLength(userId, weekStart) {
  let length = 1;
  let checkWeek = weekStart;
  while (length < WEEKLY_STREAK_AMOUNTS.length) {
    checkWeek = new Date(checkWeek.getTime() - MS_PER_WEEK);
    const priorPaid = await PointTransaction.exists({
      user: userId,
      type: 'weekly_streak_bonus',
      'metadata.weekStart': checkWeek,
    });
    if (!priorPaid) {
      break;
    }
    length += 1;
  }
  return length;
}

// Checks whether `userId` met all three weekly goals (verified game, quiz completion, site visit)
// in the week containing `referenceDate`, and pays the escalating streak bonus if so. Safe to call
// repeatedly for the same week — the unique partial index on metadata.weekStart makes the payout
// land at most once, however many times (or from however many trigger points) this runs.
async function evaluateWeeklyStreak(userId, referenceDate = new Date()) {
  const user = await User.findById(userId).select('isGuest lastActiveAt');
  if (!user || user.isGuest) {
    return;
  }

  const weekStart = getWeekStart(referenceDate);
  const weekEnd = getWeekEnd(weekStart);

  const [hasGame, hasQuiz] = await Promise.all([
    hasVerifiedGameInWeek(userId, weekStart, weekEnd),
    hasQuizCompletionInWeek(userId, weekStart, weekEnd),
  ]);

  if (!hasGame || !hasQuiz || !wasActiveInWeek(user, weekStart, weekEnd)) {
    return;
  }

  const streakLength = await computeStreakLength(userId, weekStart);
  const amount = WEEKLY_STREAK_AMOUNTS[Math.min(streakLength, WEEKLY_STREAK_AMOUNTS.length) - 1];

  await recordAwardOnce({
    userId,
    type: 'weekly_streak_bonus',
    amount,
    metadata: { weekStart },
  });
}

// Evaluates every player from a just-verified game. One player's failure does not stop the others;
// throws an AggregateError listing every failure once all evaluations were attempted (mirrors
// pointsService.awardGamePoints' failure-isolation pattern), so the route can log it without
// blocking the response.
async function evaluateWeeklyStreakForPlayers(userIds, referenceDate = new Date()) {
  const results = await Promise.allSettled(
    userIds.map(userId => evaluateWeeklyStreak(userId, referenceDate))
  );

  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to evaluate weekly streak for ${failures.length} of ${userIds.length} players`
    );
  }
}

module.exports = {
  evaluateWeeklyStreak,
  evaluateWeeklyStreakForPlayers,
};
