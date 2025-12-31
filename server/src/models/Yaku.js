/**
 * Enum representing all Yaku (scoring patterns) in Riichi Mahjong
 * Organized by han value
 */

const Yaku = {
  // 1-Han Yaku
  RIICHI: 'Riichi',
  TANYAO: 'All Simples',
  MENZEN_TSUMO: 'Fully Concealed Hand',
  YAKUHAI_SEAT_WIND: 'Yakuhai Seat Wind',
  YAKUHAI_PREVALENT_WIND: 'Yakuhai Prevalent Wind',
  YAKUHAI_DRAGONS: 'Yakuhai Dragons',
  PINFU: 'Pinfu',
  IIPEIKOU: 'Pure Double Sequence',
  ROBBING_A_KAN: 'Robbing a Kan',
  AFTER_A_KAN: 'After a Kan',
  UNDER_THE_SEA: 'Under the Sea',
  UNDER_THE_RIVER: 'Under the River',
  IPPATSU: 'Ippatsu',

  // 2-Han Yaku
  DOUBLE_RIICHI: 'Double Riichi',
  SANSHOKU_DOUKOU: 'Mixed Triple Triplets',
  SANKANTSU: 'Three Quads',
  TOITOI: 'All Triplets',
  SANANKOU: 'Three Concealed Triplets',
  LITTLE_THREE_DRAGONS: 'Little Three Dragons',
  ALL_TERMINALS_AND_HONORS: 'All Terminals and Honors',
  CHIITOITSU: 'Seven Pairs',
  CHANTA: 'Half Outside Hand',
  ITTSUU: 'Pure Straight',
  SANSHOKU_DOUJUN: 'Mixed Triple Sequence',

  // 3-Han Yaku
  HONITSU: 'Half Flush',
  RYANPEIKOU: 'Twice Pure Double Sequence',
  JUNCHAN: 'Full Outside Hand',

  // 5-Han Yaku
  NAGASHI_MANGAN: 'Mangan at Draw',

  // 6-Han Yaku
  CHINITSU: 'Full Flush',

  // 13-Han Yaku (Yakuman)
  KAZOE_YAKUMAN: 'Counted Yakuman',
  CHINROUTOU: 'All Terminals',
  KOKUSHI_MUSOU: 'Thirteen Orphans',
  SHOUSUUSHII: 'Little Four Winds',
  SUUKANTSU: 'Four Quads',
  CHUUREN_POUTOU: 'Nine Gates',
  TENHOU: 'Blessing of Heaven',
  CHIIHOU: 'Blessing of Earth',
  DAISANGEN: 'Big Three Dragons',
  SUUANKOU: 'Four Concealed Triplets',
  TSUUIISOU: 'All Honors',
  RYUUIISOU: 'All Green',

  // 13-Han Yaku (Double Yakuman)
  SUUANKOU_TANKI: 'Four Concealed Triplets Single Wait',
  JUNSEI_KOKUSHI_MUSOU: 'Thirteen Orphans 13-Way Wait',
  JUNSEI_CHUUREN_POUTOU: 'True Nine Gates',
  DAISUUSHII: 'Big Four Winds',
};

/**
 * Get all Yaku names as an array
 * @returns {string[]} Array of all Yaku names
 */
const getAllYaku = () => {
  return Object.values(Yaku);
};

module.exports = {
  Yaku,
  getAllYaku,
};

