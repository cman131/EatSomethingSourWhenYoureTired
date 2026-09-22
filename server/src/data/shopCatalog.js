// Single source of truth for the flair shop catalog. Used by scripts/seedShop.js and by
// POST /api/shop/seed. The seed matches items by `name`, so names must be unique across
// all categories. `value` is copied onto User.equippedFlair at equip time, so the `value`
// of an existing item must never change.
//
// sortOrder is per category and lists entry, then mid, then premium.

const SHOP_CATALOG = [
  // nameColor — 16 items
  { name: 'Sakura Pink',    description: 'Delicate cherry blossom pink',           category: 'nameColor', cost: 50,  tier: 'entry',   value: 'flair-color-pink',     sortOrder: 1 },
  { name: 'Sea Teal',       description: 'Inspired by the East China Sea',          category: 'nameColor', cost: 50,  tier: 'entry',   value: 'flair-color-teal',     sortOrder: 2 },
  { name: 'Matcha',         description: 'Whisked green tea',                       category: 'nameColor', cost: 50,  tier: 'entry',   value: 'flair-color-matcha',   sortOrder: 3 },
  { name: 'Aizome',         description: 'Traditional indigo dye',                  category: 'nameColor', cost: 50,  tier: 'entry',   value: 'flair-color-aizome',   sortOrder: 4 },
  { name: 'Amber',          description: 'Warm amber glow',                         category: 'nameColor', cost: 75,  tier: 'entry',   value: 'flair-color-amber',    sortOrder: 5 },
  { name: 'Umeboshi',       description: 'Pickled sour plum',                       category: 'nameColor', cost: 75,  tier: 'entry',   value: 'flair-color-umeboshi', sortOrder: 6 },
  { name: 'Sumi Ink',       description: 'Calligraphy ink, understated',            category: 'nameColor', cost: 75,  tier: 'entry',   value: 'flair-color-sumi',     sortOrder: 7 },
  { name: 'Jade Green',     description: 'Classic jade green',                      category: 'nameColor', cost: 125, tier: 'mid',     value: 'flair-color-emerald',  sortOrder: 8 },
  { name: 'Ocean Blue',     description: 'A deep ocean blue',                       category: 'nameColor', cost: 125, tier: 'mid',     value: 'flair-color-blue',     sortOrder: 9 },
  { name: 'Fuji Sunset',    description: 'The dusk sky behind the mountain',        category: 'nameColor', cost: 125, tier: 'mid',     value: 'flair-color-fuji',     sortOrder: 10 },
  { name: 'Royal Purple',   description: 'Regal and commanding',                    category: 'nameColor', cost: 150, tier: 'mid',     value: 'flair-color-purple',   sortOrder: 11 },
  { name: 'Moonlit Bamboo', description: 'A bamboo grove under the moon',           category: 'nameColor', cost: 150, tier: 'mid',     value: 'flair-color-moonlit',  sortOrder: 12 },
  { name: 'Crimson Dragon', description: 'The fierce red of a dragon',              category: 'nameColor', cost: 300, tier: 'premium', value: 'flair-color-red',      sortOrder: 13 },
  { name: 'Mahjong Gold',   description: 'The golden color of a winning hand',      category: 'nameColor', cost: 300, tier: 'premium', value: 'flair-color-gold',     sortOrder: 14 },
  { name: 'Neon Akihabara', description: 'Electric-town lights, flowing',           category: 'nameColor', cost: 300, tier: 'premium', value: 'flair-color-neon',     sortOrder: 15 },
  { name: 'Tanabata Stars', description: 'Midnight blue to starlight, twinkling',   category: 'nameColor', cost: 300, tier: 'premium', value: 'flair-color-tanabata', sortOrder: 16 },

  // nameIcon — 17 items
  { name: 'Red Lantern',    description: 'A traditional festival lantern',          category: 'nameIcon', cost: 50,  tier: 'entry',   value: '🏮', sortOrder: 1 },
  { name: 'Mahjong Tile',   description: 'The iconic mahjong tile',                 category: 'nameIcon', cost: 50,  tier: 'entry',   value: '🀄', sortOrder: 2 },
  { name: 'Onigiri',        description: 'The rice ball that fuels every protagonist', category: 'nameIcon', cost: 50, tier: 'entry', value: '🍙', sortOrder: 3 },
  { name: 'Dango',          description: 'Sweet dumplings on a stick',              category: 'nameIcon', cost: 50,  tier: 'entry',   value: '🍡', sortOrder: 4 },
  { name: 'Lucky Star',     description: 'For lucky players',                       category: 'nameIcon', cost: 75,  tier: 'entry',   value: '⭐', sortOrder: 5 },
  { name: 'Hanafuda',       description: 'Japanese flower cards',                   category: 'nameIcon', cost: 75,  tier: 'entry',   value: '🎴', sortOrder: 6 },
  { name: 'Furin',          description: 'A summer wind chime',                     category: 'nameIcon', cost: 75,  tier: 'entry',   value: '🎐', sortOrder: 7 },
  { name: 'Bamboo',         description: 'A lucky bamboo stalk',                    category: 'nameIcon', cost: 100, tier: 'mid',     value: '🎋', sortOrder: 8 },
  { name: 'Crown',          description: 'Royalty at the table',                    category: 'nameIcon', cost: 125, tier: 'mid',     value: '👑', sortOrder: 9 },
  { name: 'Torii Gate',     description: 'The entrance to a shrine',                category: 'nameIcon', cost: 125, tier: 'mid',     value: '\u26E9\uFE0F', sortOrder: 10 },
  { name: 'Dragon',         description: 'A fearsome dragon',                       category: 'nameIcon', cost: 150, tier: 'mid',     value: '🐉', sortOrder: 11 },
  { name: 'Kitsune',        description: 'The fox spirit and shrine messenger',     category: 'nameIcon', cost: 150, tier: 'mid',     value: '🦊', sortOrder: 12 },
  { name: 'Flame',          description: 'You are on fire',                         category: 'nameIcon', cost: 250, tier: 'premium', value: '🔥', sortOrder: 13 },
  { name: 'Cherry Blossom', description: 'A delicate sakura bloom',                 category: 'nameIcon', cost: 300, tier: 'premium', value: '🌸', sortOrder: 14 },
  { name: 'Firework',       description: 'Bursts outward and pulses, glow shifting pink to gold', category: 'nameIcon', cost: 300, tier: 'premium', value: '🎆', sortOrder: 15 },
  { name: 'Great Wave',     description: 'Rolls and crests with a sea-blue glow',   category: 'nameIcon', cost: 300, tier: 'premium', value: '🌊', sortOrder: 16 },
  { name: 'Ninja',          description: 'Blurs out, then reappears with a flash',  category: 'nameIcon', cost: 300, tier: 'premium', value: '🥷', sortOrder: 17 },

  // profileBorder — 16 items
  { name: 'Blush',         description: 'A soft pink ring',                         category: 'profileBorder', cost: 50,  tier: 'entry',   value: 'flair-ring-blush',     sortOrder: 1 },
  { name: 'Pebble',        description: 'A simple stone-grey ring',                 category: 'profileBorder', cost: 50,  tier: 'entry',   value: 'flair-ring-pebble',    sortOrder: 2 },
  { name: 'Manzu',         description: 'The characters suit, in tile red',         category: 'profileBorder', cost: 50,  tier: 'entry',   value: 'flair-ring-manzu',     sortOrder: 3 },
  { name: 'Pinzu',         description: 'The circles suit, in dot blue',            category: 'profileBorder', cost: 50,  tier: 'entry',   value: 'flair-ring-pinzu',     sortOrder: 4 },
  { name: 'Souzu',         description: 'The bamboo suit, in stalk green',          category: 'profileBorder', cost: 75,  tier: 'entry',   value: 'flair-ring-souzu',     sortOrder: 5 },
  { name: 'Persimmon',     description: 'The orange of an autumn kaki',             category: 'profileBorder', cost: 75,  tier: 'entry',   value: 'flair-ring-persimmon', sortOrder: 6 },
  { name: 'Jade Ring',     description: 'Rich jade border',                         category: 'profileBorder', cost: 125, tier: 'mid',     value: 'flair-mid-jade',       sortOrder: 7 },
  { name: 'Cobalt Ring',   description: 'Deep cobalt border',                       category: 'profileBorder', cost: 125, tier: 'mid',     value: 'flair-mid-cobalt',     sortOrder: 8 },
  { name: 'Torii Ring',    description: 'Shrine-gate vermilion, deepening to burnt red', category: 'profileBorder', cost: 125, tier: 'mid', value: 'flair-mid-torii',     sortOrder: 9 },
  { name: 'Sakura Ring',   description: 'Cherry blossom pink border',               category: 'profileBorder', cost: 150, tier: 'mid',     value: 'flair-mid-sakura',     sortOrder: 10 },
  { name: 'Wisteria Ring', description: 'Fuji blossoms, lavender to deep violet',   category: 'profileBorder', cost: 150, tier: 'mid',     value: 'flair-mid-wisteria',   sortOrder: 11 },
  { name: 'Rainbow Halo',  description: 'Slowly spinning rainbow conic gradient',   category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-rainbow', sortOrder: 12 },
  { name: 'Dragon Scale',  description: 'Spinning emerald gradient — shimmering scales', category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-dragon', sortOrder: 13 },
  { name: 'Hanabi',        description: 'Fireworks circling in the night sky',      category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-hanabi',  sortOrder: 14 },
  { name: 'Kitsune Fire',  description: 'Fox fire, spinning the other way',         category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-kitsune', sortOrder: 15 },
  { name: 'Yozakura',      description: 'Night cherry blossoms in the dark',        category: 'profileBorder', cost: 300, tier: 'premium', value: 'flair-border-yozakura', sortOrder: 16 },

  // profileBackdrop — 7 items. A banner strip behind the profile header (profile page only).
  { name: 'Shoji Paper',    description: 'Soft rice-paper white, like a sliding screen', category: 'profileBackdrop', cost: 50,  tier: 'entry',   value: 'flair-backdrop-shoji',    sortOrder: 1 },
  { name: 'Tatami Weave',   description: 'Woven straw-mat green',                        category: 'profileBackdrop', cost: 50,  tier: 'entry',   value: 'flair-backdrop-tatami',   sortOrder: 2 },
  { name: 'Sumi Wash',      description: 'A quiet wash of diluted ink',                  category: 'profileBackdrop', cost: 75,  tier: 'entry',   value: 'flair-backdrop-sumi',     sortOrder: 3 },
  { name: 'Fuji Dawn',      description: 'First light over the mountain',                category: 'profileBackdrop', cost: 125, tier: 'mid',     value: 'flair-backdrop-fuji',     sortOrder: 4 },
  { name: 'Bamboo Grove',   description: 'Green shade filtering into teal',              category: 'profileBackdrop', cost: 150, tier: 'mid',     value: 'flair-backdrop-bamboo',   sortOrder: 5 },
  { name: 'Tanabata Night', description: 'A drifting starry sky, midnight to violet',    category: 'profileBackdrop', cost: 300, tier: 'premium', value: 'flair-backdrop-tanabata', sortOrder: 6 },
  { name: 'Koi Pond',       description: 'Ripples of gold and vermilion sliding past',   category: 'profileBackdrop', cost: 300, tier: 'premium', value: 'flair-backdrop-koi',      sortOrder: 7 },

  // title — 14 items
  { name: 'Regular',             description: 'A familiar face at the table',                        category: 'title', cost: 50,  tier: 'entry',   value: 'Regular',             sortOrder: 1 },
  { name: 'Nakama',              description: 'Your crew, your comrades, your table',                category: 'title', cost: 50,  tier: 'entry',   value: 'Nakama',              sortOrder: 2 },
  { name: 'Chi Chi',             description: 'Calling a run, named after the Dragon Ball mom',      category: 'title', cost: 50,  tier: 'entry',   value: 'Chi Chi',             sortOrder: 3 },
  { name: 'Tenpai',              description: 'Always one tile away from winning',                   category: 'title', cost: 75,  tier: 'entry',   value: 'Tenpai',              sortOrder: 4 },
  { name: 'PonPonPon',           description: 'Triplet call, Harajuku beat',                         category: 'title', cost: 75,  tier: 'entry',   value: 'PonPonPon',           sortOrder: 5 },
  { name: 'Kan I Help You?',     description: 'A quad-calling customer service specialist',          category: 'title', cost: 75,  tier: 'entry',   value: 'Kan I Help You?',     sortOrder: 6 },
  { name: 'East Wind',           description: "The dealer's seat — a position of prestige",          category: 'title', cost: 125, tier: 'mid',     value: 'East Wind',           sortOrder: 7 },
  { name: 'Power of Friendship', description: 'The trope that wins every final arc',                 category: 'title', cost: 125, tier: 'mid',     value: 'Power of Friendship', sortOrder: 8 },
  { name: 'Dragon Slayer',       description: 'Defeated more than a few big hands',                  category: 'title', cost: 150, tier: 'mid',     value: 'Dragon Slayer',       sortOrder: 9 },
  { name: 'Dora Hunter',         description: 'Always chasing bonus tiles',                          category: 'title', cost: 175, tier: 'mid',     value: 'Dora Hunter',         sortOrder: 10 },
  { name: 'Over 9000 Han',       description: 'The scouter says this hand is worth more than 9000 han', category: 'title', cost: 175, tier: 'mid',  value: 'Over 9000 Han',       sortOrder: 11 },
  { name: 'Chicken Farmer',      description: "Wins without a single yaku. Honkaku's nemesis.",      category: 'title', cost: 300, tier: 'premium', value: 'Chicken Farmer',      sortOrder: 12 },
  { name: 'Chombo Chaser',       description: 'A dedicated student of the penalty sheet.',           category: 'title', cost: 300, tier: 'premium', value: 'Chombo Chaser',       sortOrder: 13 },
  { name: 'Tsumo-nami',          description: 'A self-drawn win that hits like a wave',              category: 'title', cost: 300, tier: 'premium', value: 'Tsumo-nami',          sortOrder: 14 },
];

module.exports = { SHOP_CATALOG };
