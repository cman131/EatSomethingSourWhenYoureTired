// WRC Penalties 2025 — World Riichi Championship
// Source: https://static1.squarespace.com/static/634a7884c297a25f06589b79/t/6833a1f248230718b731592f/1748214258864/WRC+Penalties+2025.pdf
// Authored by Sylvain Malbec, WRC's rule director, 25 May 2025

export type PenaltyType = 'warning' | 'point_penalty' | 'dead_hand' | 'chonbo' | 'disqualification' | 'none' | 'discretion';

export interface PenaltyEntry {
  id: string;
  sectionNumber: string;
  sectionTitle: string;
  subsectionTitle: string;
  description: string;
  penalty: string;
  penaltyType: PenaltyType;
  tags: string[];
}

export const wrcPenalties: PenaltyEntry[] = [
  // ─── 12.1 General Principles ───────────────────────────────────────────────
  {
    id: '12.1-general',
    sectionNumber: '12.1',
    sectionTitle: 'General principles',
    subsectionTitle: 'General principles',
    description:
      'The penalties assume the offending player is solely responsible for their actions. Penalties should be proportional to the level of disturbance; players should not benefit from committing a foul. Referees have authority to adapt a penalty to the actual situation. Intentionally committing a foul is cheating. Once a player has discarded they can no longer cancel declarations or correct their hand. A player is always allowed to take a claimed tile until their next draw. When a problem arises, all four players must halt the game. To call a referee, clearly say "referee" and raise your hand.',
    penalty: 'At referee discretion',
    penaltyType: 'discretion',
    tags: ['referee', 'general', 'discard', 'halt', 'call referee'],
  },

  // ─── 12.2 Types of Penalties ───────────────────────────────────────────────
  {
    id: '12.2-warning',
    sectionNumber: '12.2',
    sectionTitle: 'Types of penalties',
    subsectionTitle: 'Warning',
    description:
      'WARNING — For minor offences. Minor offences are warned but not penalized. Repeated cases or refusal to follow requests may lead to obstruction penalties at the referee\'s discretion.',
    penalty: 'Warning (no point penalty)',
    penaltyType: 'warning',
    tags: ['warning', 'minor', 'offence'],
  },
  {
    id: '12.2-point-penalty',
    sectionNumber: '12.2',
    sectionTitle: 'Types of penalties',
    subsectionTitle: 'Point penalty',
    description:
      'POINT PENALTY — For moderate to major offences, or particular cases. The points are removed from the offending player\'s tournament score. They are not added to opponents\' scores. It does not change the table\'s score. A tournament score of 1P is equivalent to 1,000 points at the table.',
    penalty: 'Points deducted from tournament score',
    penaltyType: 'point_penalty',
    tags: ['point penalty', 'tournament score', 'moderate', 'major'],
  },
  {
    id: '12.2-dead-hand',
    sectionNumber: '12.2',
    sectionTitle: 'Types of penalties',
    subsectionTitle: 'Dead hand',
    description:
      'DEAD HAND — When the offending player\'s hand cannot continue normally. The offending player can no longer make a sequence, triplet, quad, declare riichi, nor win during this hand. This includes the interdiction to declare a concealed quad. If the player has not declared riichi, they can still choose the tiles they discard. The hand is noten.',
    penalty: 'Dead hand',
    penaltyType: 'dead_hand',
    tags: ['dead hand', 'noten', 'sequence', 'triplet', 'quad', 'riichi', 'win'],
  },
  {
    id: '12.2-chonbo',
    sectionNumber: '12.2',
    sectionTitle: 'Types of penalties',
    subsectionTitle: 'Chonbo',
    description:
      'CHONBO — When opponents\' hands are significantly impacted or the game cannot continue normally. The offending player gets a 30P point penalty and the hand is re-dealt as if it never happened. Seat winds remain the same, no continuance counter is added nor removed, and riichi deposits are returned. There is no "reverse mangan payment". Special cases: (1) If chonbo occurs simultaneously with a win, the penalty is voided and the winning hand is scored. (2) If chonbo occurs simultaneously with an exhaustive draw, the penalty applies normally — no tenpai payment, no continuance counters, hand is re-dealt. (3) If several players make a chonbo at the same time, they all get the 30P penalty and the hand is re-dealt.',
    penalty: '30P point penalty + hand re-dealt',
    penaltyType: 'chonbo',
    tags: ['chonbo', '30p', 'redeal', 're-deal', 'riichi deposit', 'exhaustive draw', 'win'],
  },
  {
    id: '12.2-disqualification',
    sectionNumber: '12.2',
    sectionTitle: 'Types of penalties',
    subsectionTitle: 'Disqualification',
    description:
      'DISQUALIFICATION — When the tournament cannot continue normally. The offending player is not allowed to play anymore for the whole tournament. They will not be listed in the ranking. Relevant organizations, such as the national federation the player depends on, will be informed.',
    penalty: 'Disqualification from the tournament',
    penaltyType: 'disqualification',
    tags: ['disqualification', 'cheating', 'national federation', 'ranking'],
  },

  // ─── 12.3.1 Shuffling and drawing ──────────────────────────────────────────
  {
    id: '12.3.1-deal-errors',
    sectionNumber: '12.3.1',
    sectionTitle: 'Shuffling and drawing',
    subsectionTitle: 'Errors occurring during the deal',
    description:
      'Minor incidents during the deal are corrected without penalty. If the incident is too important to overlook, the tiles are shuffled again and the hand is re-dealt without penalty. If the East player discards before every player has drawn their tiles, they will get a warning and the deal is completed before proceeding. However, the East player will get a chonbo if it is discovered after the South player has drawn or called.',
    penalty: 'Warning (early cases); Chonbo if discovered after South player draws or calls',
    penaltyType: 'chonbo',
    tags: ['deal', 'shuffle', 'east player', 'discard', 'draw', 'warning', 'chonbo'],
  },
  {
    id: '12.3.1-too-many-tiles',
    sectionNumber: '12.3.1',
    sectionTitle: 'Shuffling and drawing',
    subsectionTitle: 'Too many or too few tiles',
    description:
      'A player\'s hand must have 14 tiles during their turn, and 13 otherwise. Extra tiles in quads are not counted. A player having too many or too few tiles cannot correct it and receives a chonbo. A player failing to take a called tile before their next draw can no longer take the tile and will receive a chonbo for having too few tiles.',
    penalty: 'Chonbo',
    penaltyType: 'chonbo',
    tags: ['too many tiles', 'too few tiles', 'hand size', '14 tiles', '13 tiles', 'chonbo', 'called tile'],
  },
  {
    id: '12.3.1-wrong-draw',
    sectionNumber: '12.3.1',
    sectionTitle: 'Shuffling and drawing',
    subsectionTitle: 'Wrongly drawing tiles',
    description:
      'If a player draws from the wrong place in the wall, or out of turn, they must place it back without penalty. If the player has already included the tile into their hand so they cannot prove which tile it was, they will receive a chonbo.',
    penalty: 'No penalty if placed back; Chonbo if mixed into hand',
    penaltyType: 'chonbo',
    tags: ['wrong draw', 'wall', 'out of turn', 'mixed hand', 'chonbo'],
  },
  {
    id: '12.3.1-reveal-tiles',
    sectionNumber: '12.3.1',
    sectionTitle: 'Shuffling and drawing',
    subsectionTitle: 'Wrongly revealing tiles',
    description:
      'Wrongly revealed tiles are placed back where they came from. If the incident happens during the deal and is considered a problem, tiles are shuffled again without penalty. Penalty table: Knocking over 1 or 2 tiles → Warning, 5P point penalty if repeated. Knocking over 3 to 6 tiles → Dead hand. Knocking over 7 or more tiles → Chonbo.',
    penalty: 'Warning / 5P (1–2 tiles); Dead hand (3–6 tiles); Chonbo (7+ tiles)',
    penaltyType: 'dead_hand',
    tags: ['knock over', 'reveal tiles', 'dead hand', 'chonbo', 'warning', '5p', 'tiles'],
  },

  // ─── 12.3.2 Speed of play ───────────────────────────────────────────────────
  {
    id: '12.3.2-drawing-too-fast',
    sectionNumber: '12.3.2',
    sectionTitle: 'Speed of play',
    subsectionTitle: 'Drawing too fast / Calling too late',
    description:
      'If a player draws too fast for the other players to have time to call, they should be reminded to adjust their speed to the table. The draw takes priority and the call is voided.',
    penalty: 'Reminder (no formal penalty); call is voided',
    penaltyType: 'none',
    tags: ['drawing too fast', 'speed', 'call voided', 'draw priority'],
  },
  {
    id: '12.3.2-calling-too-fast',
    sectionNumber: '12.3.2',
    sectionTitle: 'Speed of play',
    subsectionTitle: 'Calling too fast / Calling too late',
    description:
      'Even if a player calls too fast, other players can still make calls for a win as they take priority. Multiple calls for a win are resolved by turn order. If there is no call for a win, then the first call takes precedence. Only the call having precedence is resolved; other calls are voided.',
    penalty: 'Non-priority calls voided',
    penaltyType: 'none',
    tags: ['calling too fast', 'calling too late', 'win priority', 'turn order', 'call voided'],
  },

  // ─── 12.3.3 Calls and declarations ─────────────────────────────────────────
  {
    id: '12.3.3-empty-call',
    sectionNumber: '12.3.3',
    sectionTitle: 'Calls and declarations',
    subsectionTitle: 'Empty call and changing a call',
    description:
      'An empty call is making a call or declaration then cancelling it. Players are not allowed to change their calls, even with a quick correction — they get a warning and must complete the first call or be penalized for an empty call. Empty calls for groups, empty concealed quad declarations, and empty riichi declarations result in a dead hand. Empty winning declarations are serious offences and result in a chonbo.',
    penalty: 'Warning + must complete call; Dead hand (empty group/riichi); Chonbo (empty winning declaration)',
    penaltyType: 'dead_hand',
    tags: ['empty call', 'change call', 'dead hand', 'chonbo', 'riichi', 'ron', 'cancel'],
  },
  {
    id: '12.3.3-confusing-call',
    sectionNumber: '12.3.3',
    sectionTitle: 'Calls and declarations',
    subsectionTitle: 'Confusing call and silent call',
    description:
      'Players must use valid terms: "chii" (sequence), "pon" (triplet), "kan" (quad), "riichi"/"reach" (riichi), "ron" (win by calling), "tsumo" (win by self-draw). Using an alternative term (e.g. from Chinese mahjong) or not speaking clearly requires showing the correct tiles — the call is still valid but the player gets a warning. If unclear whether "pon" or "ron" was said: if the player reveals two tiles it is assumed "pon"; if they reveal their whole hand it is assumed "ron".',
    penalty: 'Warning',
    penaltyType: 'warning',
    tags: ['chii', 'pon', 'kan', 'riichi', 'reach', 'ron', 'tsumo', 'call', 'declaration', 'confusing', 'wrong term'],
  },
  {
    id: '12.3.3-dead-hand-call',
    sectionNumber: '12.3.3',
    sectionTitle: 'Calls and declarations',
    subsectionTitle: 'Calling when having a dead hand',
    description:
      'A player with a dead hand making calls for groups, empty concealed quad, or riichi declarations will get a 30P point penalty and the call is voided. This does not apply if the offending player did not know their hand was dead — they get a warning instead, the hand remains dead, and the call is voided. Declaring a win with a dead hand results in a chonbo, even if the player was unaware of their dead hand status.',
    penalty: '30P point penalty (if aware); Warning (if unaware); Chonbo (winning declaration with dead hand)',
    penaltyType: 'chonbo',
    tags: ['dead hand', 'call', '30p', 'chonbo', 'warning', 'voided', 'group', 'riichi'],
  },

  // ─── 12.3.4 Melds ───────────────────────────────────────────────────────────
  {
    id: '12.3.4-invalid-group',
    sectionNumber: '12.3.4',
    sectionTitle: 'Melds',
    subsectionTitle: 'Invalid group',
    description:
      'A player melding a group that is not a valid sequence, triplet, or quad, or declaring a false concealed quad, can correct it as long as they have not discarded. After discarding, the invalid group cannot be changed and the player has a dead hand. If an invalid quad is discovered after discarding, the player gets a chonbo instead (because invalid quads interfere with replacement tiles and the maximum number of quads).',
    penalty: 'Dead hand (invalid group after discard); Chonbo (invalid quad after discard)',
    penaltyType: 'dead_hand',
    tags: ['invalid group', 'meld', 'sequence', 'triplet', 'quad', 'false quad', 'dead hand', 'chonbo'],
  },
  {
    id: '12.3.4-swap-calling',
    sectionNumber: '12.3.4',
    sectionTitle: 'Melds',
    subsectionTitle: 'Swap-calling',
    description:
      'Swap-calling is determined when the player discards and results in a dead hand. The melded group and the discarded tile cannot be changed. However, if the player already had a dead hand, the call is voided and they are penalized for calling with a dead hand as per section 12.3.3.',
    penalty: 'Dead hand',
    penaltyType: 'dead_hand',
    tags: ['swap-calling', 'swap calling', 'meld', 'discard', 'dead hand'],
  },
  {
    id: '12.3.4-wrong-placement',
    sectionNumber: '12.3.4',
    sectionTitle: 'Melds',
    subsectionTitle: 'Wrong placement of the called tile',
    description:
      'The tile called to make a group must be placed sideways to indicate who discarded it. If the caller places it incorrectly or rotates the wrong tile, it must be pointed out and corrected immediately without any penalty. Leaving this uncorrected may lead to a player being considered furiten on a tile they have not actually discarded.',
    penalty: 'No penalty if corrected immediately',
    penaltyType: 'none',
    tags: ['called tile', 'placement', 'sideways', 'furiten', 'meld', 'sequence', 'rotate'],
  },

  // ─── 12.3.5 Riichi declarations ─────────────────────────────────────────────
  {
    id: '12.3.5-riichi-complete',
    sectionNumber: '12.3.5',
    sectionTitle: 'Riichi declarations',
    subsectionTitle: 'Riichi declaration completion',
    description:
      'A riichi declaration is completed when the player either says "riichi" (or "reach"), discards a tile sideways, or pays the 1,000 points deposit.',
    penalty: 'N/A — informational',
    penaltyType: 'none',
    tags: ['riichi', 'reach', 'declaration', 'deposit', '1000 points', 'sideways'],
  },
  {
    id: '12.3.5-forgot-riichi',
    sectionNumber: '12.3.5',
    sectionTitle: 'Riichi declarations',
    subsectionTitle: 'Forgetting to say "riichi" or to pay the deposit',
    description:
      'If a player forgets to say "riichi" or forgets to pay the deposit, the declaration is still valid. The player gets a warning.',
    penalty: 'Warning (declaration still valid)',
    penaltyType: 'warning',
    tags: ['riichi', 'forgot', 'deposit', 'warning'],
  },
  {
    id: '12.3.5-forgot-rotate',
    sectionNumber: '12.3.5',
    sectionTitle: 'Riichi declarations',
    subsectionTitle: 'Forgetting to rotate the discarded tile',
    description:
      'If a player forgets to place their discard sideways and the tile to turn is unknown, the earliest discarded tile among the supposed ones is chosen regarding furiten. The player gets a warning.',
    penalty: 'Warning',
    penaltyType: 'warning',
    tags: ['riichi', 'rotate', 'sideways', 'discard', 'furiten', 'warning'],
  },
  {
    id: '12.3.5-noten-riichi',
    sectionNumber: '12.3.5',
    sectionTitle: 'Riichi declarations',
    subsectionTitle: 'Noten riichi',
    description:
      'A player declaring riichi on a noten hand is penalized with a chonbo. This is only determined if the player declares a win or in case of an exhaustive draw. The noten riichi penalty does not apply if the player\'s hand is noten solely due to a dead hand penalty occurring after the riichi declaration — the player must show their hand to prove it was tenpai before the dead hand penalty.',
    penalty: 'Chonbo',
    penaltyType: 'chonbo',
    tags: ['noten riichi', 'noten', 'riichi', 'chonbo', 'tenpai', 'exhaustive draw'],
  },
  {
    id: '12.3.5-riichi-open-hand',
    sectionNumber: '12.3.5',
    sectionTitle: 'Riichi declarations',
    subsectionTitle: 'Declaring riichi with an open hand',
    description:
      'A player declaring riichi on an open hand is penalized with a dead hand. The riichi declaration is not valid, so they do not pay the deposit.',
    penalty: 'Dead hand (no deposit paid)',
    penaltyType: 'dead_hand',
    tags: ['riichi', 'open hand', 'meld', 'dead hand', 'deposit'],
  },
  {
    id: '12.3.5-opening-after-riichi',
    sectionNumber: '12.3.5',
    sectionTitle: 'Riichi declarations',
    subsectionTitle: 'Opening the hand after riichi',
    description:
      'Calling for a sequence, triplet, or called quad after having declared riichi is penalized with a dead hand. The call is voided. The player can still declare a concealed quad with the tile drawn this turn, in accordance with rule 8.9.1.',
    penalty: 'Dead hand (call voided)',
    penaltyType: 'dead_hand',
    tags: ['riichi', 'open hand', 'chii', 'pon', 'kan', 'called quad', 'dead hand', 'concealed quad'],
  },
  {
    id: '12.3.5-discard-from-hand-riichi',
    sectionNumber: '12.3.5',
    sectionTitle: 'Riichi declarations',
    subsectionTitle: 'Discarding a tile from the hand after riichi',
    description:
      'A player discarding a tile from their hand after having declared riichi will get a dead hand. If the hand ends in a draw, the offending player would get a chonbo for noten riichi, since they cannot prove their hand was valid when they declared riichi.',
    penalty: 'Dead hand; Chonbo if hand ends in draw (noten riichi)',
    penaltyType: 'dead_hand',
    tags: ['riichi', 'discard', 'hand', 'dead hand', 'chonbo', 'noten riichi', 'draw'],
  },
  {
    id: '12.3.5-invalid-concealed-quad',
    sectionNumber: '12.3.5',
    sectionTitle: 'Riichi declarations',
    subsectionTitle: 'Invalid concealed quad after riichi',
    description:
      'A player declaring an invalid concealed quad after having declared riichi is penalized with a chonbo. This is only determined if the player declares a win or in case of an exhaustive draw.',
    penalty: 'Chonbo',
    penaltyType: 'chonbo',
    tags: ['riichi', 'concealed quad', 'invalid', 'chonbo', 'kan'],
  },

  // ─── 12.3.6 End of the hand ─────────────────────────────────────────────────
  {
    id: '12.3.6-winning-tile-mixed',
    sectionNumber: '12.3.6',
    sectionTitle: 'End of the hand',
    subsectionTitle: 'Winning by self-draw after mixing the winning tile into the hand',
    description:
      'If the winning tile is ambiguous (mixed into the hand), the player gets a warning and ambiguous minipoints and yaku cannot be scored. The player still scores minipoints and yaku for which the hand qualifies regardless of which tile is the winning tile.',
    penalty: 'Warning; ambiguous minipoints/yaku cannot be scored',
    penaltyType: 'warning',
    tags: ['tsumo', 'winning tile', 'mixed', 'ambiguous', 'minipoints', 'yaku', 'warning'],
  },
  {
    id: '12.3.6-win-tenpai-confusion',
    sectionNumber: '12.3.6',
    sectionTitle: 'End of the hand',
    subsectionTitle: 'Confusing win / tenpai declaration',
    description:
      'When winning on the last tile, players should make their win declaration explicit. If the player reveals their hand and immediately declares a win, the win is valid. If the player clearly first declares tenpai and then a win, the win declaration is voided because the hand is already over.',
    penalty: 'Win declaration voided if tenpai declared first',
    penaltyType: 'none',
    tags: ['win', 'tenpai', 'last tile', 'declaration', 'voided', 'hand over'],
  },
  {
    id: '12.3.6-play-after-end',
    sectionNumber: '12.3.6',
    sectionTitle: 'End of the hand',
    subsectionTitle: 'Playing after the end of the hand',
    description:
      'A player mistakenly drawing or calling after the live wall is exhausted will get a warning. If the player mixes the drawn tile into their hand, they will get a dead hand (their hand will be noten for the tenpai/noten payment). Any calls, including win declarations, are voided without further penalties.',
    penalty: 'Warning; Dead hand if tile mixed in',
    penaltyType: 'dead_hand',
    tags: ['wall exhausted', 'draw', 'call', 'after end', 'dead hand', 'warning', 'noten'],
  },
  {
    id: '12.3.6-tenpai-before-end',
    sectionNumber: '12.3.6',
    sectionTitle: 'End of the hand',
    subsectionTitle: 'Tenpai / noten declaration before the end of the hand',
    description:
      'A player declaring tenpai or noten before the end of the hand, without revealing their tiles, will get a dead hand. However, they will get a chonbo if they reveal their hand, or if it tricks another player to declare tenpai and reveal their hand.',
    penalty: 'Dead hand (without revealing); Chonbo (if reveals hand or tricks another player)',
    penaltyType: 'dead_hand',
    tags: ['tenpai', 'noten', 'early declaration', 'dead hand', 'chonbo', 'reveal hand'],
  },
  {
    id: '12.3.6-tenpai-out-of-order',
    sectionNumber: '12.3.6',
    sectionTitle: 'End of the hand',
    subsectionTitle: 'Tenpai / noten declaration out of order',
    description:
      'It is tolerated if a player declares tenpai or noten before their turn, but they cannot change their declaration.',
    penalty: 'No penalty; declaration is locked',
    penaltyType: 'none',
    tags: ['tenpai', 'noten', 'declaration', 'order', 'turn'],
  },
  {
    id: '12.3.6-silent-tenpai',
    sectionNumber: '12.3.6',
    sectionTitle: 'End of the hand',
    subsectionTitle: 'Silent tenpai / noten declaration',
    description:
      'There is no obligation to vocally declare tenpai or noten. In any case, players have to turn their hands respectively face up or down.',
    penalty: 'No penalty for silent declaration; hand must be turned face up (tenpai) or face down (noten)',
    penaltyType: 'none',
    tags: ['tenpai', 'noten', 'silent', 'face up', 'face down', 'reveal'],
  },
  {
    id: '12.3.6-incorrect-tenpai',
    sectionNumber: '12.3.6',
    sectionTitle: 'End of the hand',
    subsectionTitle: 'Incorrect tenpai / noten declaration',
    description:
      'A player declaring their hand tenpai when it is not gets a warning. Repeated offences will lead to a 5P point penalty. It is allowed to declare the hand noten when it is actually tenpai.',
    penalty: 'Warning; 5P for repeated offences',
    penaltyType: 'warning',
    tags: ['tenpai', 'noten', 'incorrect', 'false tenpai', 'warning', '5p'],
  },
  {
    id: '12.3.6-changing-tenpai',
    sectionNumber: '12.3.6',
    sectionTitle: 'End of the hand',
    subsectionTitle: 'Changing a tenpai / noten declaration',
    description:
      'Players are not allowed to change their tenpai / noten declaration, even if done before their turn. The first declaration is used, and the player gets a warning.',
    penalty: 'Warning; first declaration stands',
    penaltyType: 'warning',
    tags: ['tenpai', 'noten', 'change declaration', 'warning'],
  },

  // ─── 12.3.7 Incorrect score reporting ───────────────────────────────────────
  {
    id: '12.3.7-all-last-sheet',
    sectionNumber: '12.3.7',
    sectionTitle: 'Incorrect score reporting',
    subsectionTitle: 'Incorrect all-last sheet',
    description:
      'If the all-last sheet is completed incorrectly and it has impacted the game, the offending player will get an 8P point penalty.',
    penalty: '8P point penalty',
    penaltyType: 'point_penalty',
    tags: ['all-last', 'score sheet', '8p', 'report', 'incorrect'],
  },
  {
    id: '12.3.7-report-sheet',
    sectionNumber: '12.3.7',
    sectionTitle: 'Incorrect score reporting',
    subsectionTitle: 'Incorrect report sheet',
    description:
      'All players must make sure the report sheet is filled correctly, including other players\' scores. If a report sheet is submitted with incorrect information and the players have already reset their scoring sticks before the referee could check it, each player will get a 2P point penalty. The scores are corrected if possible.',
    penalty: '2P point penalty per player',
    penaltyType: 'point_penalty',
    tags: ['report sheet', '2p', 'score', 'incorrect', 'scoring sticks', 'all players'],
  },

  // ─── 12.3.8 Obstruction and cheating ────────────────────────────────────────
  {
    id: '12.3.8-obstruction',
    sectionNumber: '12.3.8',
    sectionTitle: 'Obstruction and cheating',
    subsectionTitle: 'Obstruction',
    description:
      'Obstruction covers any action preventing or hindering the smooth processing of the game or tournament, including during break time. Obstructions are subject to penalties at the referee\'s discretion. Repeated or very serious obstructive behaviour can result in disqualification. Examples: discarding so not every player can see the tile simultaneously; placing tiles face down after declaring riichi; using incorrect terms repeatedly; revealing other players\' hands or the wall after the end of the hand; revealing ura dora without having declared riichi and won; putting foreign objects on the table; chatting; making overly loud sounds; tapping on the table outside your turn; repeatedly tapping, twirling or fidgeting with tiles; stalling for time; refusing to count your points; repeatedly asking to recount the score.',
    penalty: 'At referee discretion; repeated/serious cases → disqualification',
    penaltyType: 'discretion',
    tags: ['obstruction', 'chatting', 'noise', 'stalling', 'face down', 'ura dora', 'tapping', 'fidgeting', 'disqualification'],
  },
  {
    id: '12.3.8-suspicious-obstruction',
    sectionNumber: '12.3.8',
    sectionTitle: 'Obstruction and cheating',
    subsectionTitle: 'Obstruction with suspicion of cheating',
    description:
      'Examples of obstruction with suspicion of cheating: touching other players\' sticks; touching the wall outside your turn or during scoring; hiding tiles with your hand or arm during play or scoring; resting your hand in the middle of the table; chatting in a language a player or referee doesn\'t understand; not stopping the game when a player raises an issue, or resuming before the issue is resolved.',
    penalty: 'At referee discretion; may lead to disqualification',
    penaltyType: 'discretion',
    tags: ['obstruction', 'cheating', 'touching sticks', 'wall', 'hiding tiles', 'chatting', 'language', 'disqualification'],
  },
  {
    id: '12.3.8-foreign-objects',
    sectionNumber: '12.3.8',
    sectionTitle: 'Obstruction and cheating',
    subsectionTitle: 'Foreign objects',
    description:
      'Foreign objects like phones, smart watches, smart glasses, notebooks, tablets, or anything hiding the tiles are forbidden. The penalty is at the referee\'s discretion based on the level of disturbance and risk of cheating. Racks require prior approval from the head referee. Yaku lists, scoring tables, simple calculators and a score sheet are allowed but should be consulted between hands. Players must mute or turn off their phones and keep them off the table. A player wearing smart glasses will be disqualified for cheating.',
    penalty: 'At referee discretion; smart glasses → disqualification',
    penaltyType: 'discretion',
    tags: ['phone', 'smart watch', 'smart glasses', 'notebook', 'tablet', 'foreign objects', 'rack', 'disqualification', 'yaku list', 'calculator'],
  },
  {
    id: '12.3.8-passing-information',
    sectionNumber: '12.3.8',
    sectionTitle: 'Obstruction and cheating',
    subsectionTitle: 'Passing information',
    description:
      'Communication at the table must be limited to mahjong actions. Revealing information meant to be kept secret is penalized at the referee\'s discretion. This includes safe/dangerous tiles, players\' strategy, yaku aimed for, tenpai/noten status outside an exhaustive draw, furiten status, anything disclosing the face of concealed tiles, and whether the discarded tile was the one drawn. It does not matter whether the disclosed information is accurate or wrong.',
    penalty: 'At referee discretion',
    penaltyType: 'discretion',
    tags: ['information', 'safe tile', 'dangerous tile', 'strategy', 'yaku', 'tenpai', 'furiten', 'concealed', 'passing info', 'communication'],
  },
  {
    id: '12.3.8-cheating',
    sectionNumber: '12.3.8',
    sectionTitle: 'Obstruction and cheating',
    subsectionTitle: 'Cheating',
    description:
      'A player caught cheating will be disqualified immediately. Intentionally committing a foul, as well as tricking a player to commit a foul, is cheating. Unnatural actions that supposedly change nothing may be a distraction to hide a sleight-of-hand — call a referee. Examples: moving a tile away from or under the table; switching identical tiles among the discards; using any communication or computing device not sanctioned by the tournament organizers; giving false information about the rules.',
    penalty: 'Disqualification',
    penaltyType: 'disqualification',
    tags: ['cheating', 'disqualification', 'sleight of hand', 'switch tiles', 'communication device', 'false information', 'foul'],
  },

  // ─── 12.3.9 Being late and missing a hanchan ─────────────────────────────────
  {
    id: '12.3.9-being-late',
    sectionNumber: '12.3.9',
    sectionTitle: 'Being late and missing a hanchan',
    subsectionTitle: 'Being late for a hanchan',
    description:
      'A player being late for a hanchan gets a 1P point penalty per minute. After ten minutes, they forfeit the hanchan.',
    penalty: '1P per minute late; forfeit after 10 minutes',
    penaltyType: 'point_penalty',
    tags: ['late', 'hanchan', '1p per minute', 'forfeit', '10 minutes'],
  },
  {
    id: '12.3.9-forfeiting',
    sectionNumber: '12.3.9',
    sectionTitle: 'Being late and missing a hanchan',
    subsectionTitle: 'Forfeiting a hanchan',
    description:
      'A player not showing up in time or leaving during a hanchan will receive no points and a 30P point penalty; they are replaced by a substitute player. This is not cumulative with the 10-minute lateness penalty — a player 10 minutes late who is substituted gets only the 30P forfeiture penalty. A player intentionally missing a hanchan without good reason can be disqualified for obstruction, especially if they leave when their score is below the penalty, or the penalty makes no real difference to their tournament score.',
    penalty: '30P point penalty + no hanchan points; possible disqualification',
    penaltyType: 'point_penalty',
    tags: ['forfeit', 'missing hanchan', '30p', 'substitute', 'disqualification', 'absent'],
  },
  {
    id: '12.3.9-substitute',
    sectionNumber: '12.3.9',
    sectionTitle: 'Being late and missing a hanchan',
    subsectionTitle: 'Substitute players',
    description:
      'Substitute players are scored normally and then not included in the ranking. They are expected to play normally so as not to give any advantage or disadvantage to the ranked players at their table toward players at other tables.',
    penalty: 'N/A — informational',
    penaltyType: 'none',
    tags: ['substitute', 'ranking', 'scored normally', 'hanchan'],
  },
  {
    id: '12.3.9-temporary-leaving',
    sectionNumber: '12.3.9',
    sectionTitle: 'Being late and missing a hanchan',
    subsectionTitle: 'Temporary leaving during a hanchan',
    description:
      'Players are not allowed to take breaks during a hanchan. The penalty is at the referee\'s discretion depending on the situation. A quick toilet break can be tolerated between hands after informing the other players.',
    penalty: 'At referee discretion',
    penaltyType: 'discretion',
    tags: ['break', 'leaving', 'hanchan', 'toilet break', 'between hands', 'referee'],
  },
];

export const metadata = {
  source: 'WRC Penalties 2025',
  sourceUrl:
    'https://static1.squarespace.com/static/634a7884c297a25f06589b79/t/6833a1f248230718b731592f/1748214258864/WRC+Penalties+2025.pdf',
  author: 'Sylvain Malbec, WRC rule director',
  version: 'v20250525',
};
