// Single source of truth for point award amounts. Both the server (pointsService.js) and the
// client (via GET /api/points/config, see routes/points.js) read from this file so the help
// modal can never drift out of sync with what actually gets paid.

const GAME_PLACEMENT_AMOUNTS = { 1: 10, 2: 7, 3: 4, 4: 2 };
const GAME_SUBMITTED_AMOUNT = 2;
const GAME_VERIFIED_AMOUNT = 1;

const TOURNAMENT_PARTICIPATION_AMOUNT = 15;
const TOURNAMENT_PLACEMENT_AMOUNTS = [200, 100, 70, 50];

const RANKED_QUALIFICATION_AMOUNT = 10;
const RANKED_PLACEMENT_AMOUNTS = [150, 100, 50];

// Quiz completion: +1 per distinct quiz, capped per calendar week since GET /generate/random
// can produce unlimited quizzes on demand.
const QUIZ_COMPLETION_AMOUNT = 1;
const QUIZ_WEEKLY_CAP_COUNT = 5;

// Weekly streak: paid once per week when a verified game, a quiz completion, and a site visit
// all land in the same week. Escalates with consecutive qualifying weeks, capped at the last value.
const WEEKLY_STREAK_AMOUNTS = [2, 3, 4, 5];

module.exports = {
  GAME_PLACEMENT_AMOUNTS,
  GAME_SUBMITTED_AMOUNT,
  GAME_VERIFIED_AMOUNT,
  TOURNAMENT_PARTICIPATION_AMOUNT,
  TOURNAMENT_PLACEMENT_AMOUNTS,
  RANKED_QUALIFICATION_AMOUNT,
  RANKED_PLACEMENT_AMOUNTS,
  QUIZ_COMPLETION_AMOUNT,
  QUIZ_WEEKLY_CAP_COUNT,
  WEEKLY_STREAK_AMOUNTS,
};
