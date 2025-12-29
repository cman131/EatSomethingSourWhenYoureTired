import React, { useState, useMemo } from 'react';
import { CalculatorIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import FuCalculatorModal from '../components/FuCalculatorModal';

interface ScoreResult {
  basePoints: number;
  tsumoDealer: number;
  tsumoNonDealer: number;
  ronDealer: number;
  ronNonDealer: number;
  isMangan: boolean;
  isHaneman: boolean;
  isBaiman: boolean;
  isSanbaiman: boolean;
  isYakuman: boolean;
}

const ScoreCalculator: React.FC = () => {
  const [han, setHan] = useState<number>(1);
  const [fu, setFu] = useState<number>(30);
  const [isTsumo, setIsTsumo] = useState<boolean>(false);
  const [isDealer, setIsDealer] = useState<boolean>(false);
  const [isFuModalOpen, setIsFuModalOpen] = useState<boolean>(false);

  const calculateScore = useMemo((): ScoreResult | null => {
    if (han < 1 || fu < 20 || fu > 110) return null;

    // Fixed values for mangan and above
    if (han >= 5) {
      // Fixed values for ron (total received)
      const ronValues: Record<number, { dealer: number; nonDealer: number }> = {
        5: { dealer: 12000, nonDealer: 8000 }, // Mangan
        6: { dealer: 18000, nonDealer: 12000 }, // Haneman
        7: { dealer: 18000, nonDealer: 12000 }, // Haneman
        8: { dealer: 24000, nonDealer: 16000 }, // Baiman
        9: { dealer: 24000, nonDealer: 16000 }, // Baiman
        10: { dealer: 24000, nonDealer: 16000 }, // Baiman
        11: { dealer: 36000, nonDealer: 24000 }, // Sanbaiman
        12: { dealer: 36000, nonDealer: 24000 }, // Sanbaiman
      };

      // Fixed values for tsumo (per-player payments)
      const tsumoValues: Record<number, { dealerFromNonDealer: number; nonDealerFromDealer: number; nonDealerFromNonDealer: number }> = {
        5: { dealerFromNonDealer: 4000, nonDealerFromDealer: 4000, nonDealerFromNonDealer: 2000 }, // Mangan
        6: { dealerFromNonDealer: 6000, nonDealerFromDealer: 6000, nonDealerFromNonDealer: 3000 }, // Haneman
        7: { dealerFromNonDealer: 6000, nonDealerFromDealer: 6000, nonDealerFromNonDealer: 3000 }, // Haneman
        8: { dealerFromNonDealer: 8000, nonDealerFromDealer: 8000, nonDealerFromNonDealer: 4000 }, // Baiman
        9: { dealerFromNonDealer: 8000, nonDealerFromDealer: 8000, nonDealerFromNonDealer: 4000 }, // Baiman
        10: { dealerFromNonDealer: 8000, nonDealerFromDealer: 8000, nonDealerFromNonDealer: 4000 }, // Baiman
        11: { dealerFromNonDealer: 12000, nonDealerFromDealer: 12000, nonDealerFromNonDealer: 6000 }, // Sanbaiman
        12: { dealerFromNonDealer: 12000, nonDealerFromDealer: 12000, nonDealerFromNonDealer: 6000 }, // Sanbaiman
      };

      const yakuman = han >= 13;
      const sanbaiman = han >= 11 && han < 13;
      const baiman = han >= 8 && han < 11;
      const haneman = han >= 6 && han < 8;
      const mangan = han === 5;

      if (yakuman) {
        // Yakuman: dealer tsumo gets 16000 from each non-dealer, non-dealer tsumo gets 16000 from dealer and 8000 from each non-dealer
        // Note: tsumoDealer is amount from dealer (for non-dealer tsumo), tsumoNonDealer is amount from each non-dealer
        return {
          basePoints: 0,
          tsumoDealer: isDealer ? 0 : 16000, // 0 for dealer tsumo (not used), 16000 from dealer for non-dealer tsumo
          tsumoNonDealer: isDealer ? 16000 : 8000, // 16000 from each non-dealer (dealer tsumo) or 8000 from each non-dealer (non-dealer tsumo)
          ronDealer: 48000,
          ronNonDealer: 32000,
          isMangan: false,
          isHaneman: false,
          isBaiman: false,
          isSanbaiman: false,
          isYakuman: true,
        };
      }

      const ronValue = ronValues[Math.min(han, 12)] || ronValues[12];
      const tsumoValue = tsumoValues[Math.min(han, 12)] || tsumoValues[12];
      
      return {
        basePoints: 0,
        tsumoDealer: tsumoValue.nonDealerFromDealer,
        tsumoNonDealer: isDealer ? tsumoValue.dealerFromNonDealer : tsumoValue.nonDealerFromNonDealer,
        ronDealer: ronValue.dealer,
        ronNonDealer: ronValue.nonDealer,
        isMangan: mangan,
        isHaneman: haneman,
        isBaiman: baiman,
        isSanbaiman: sanbaiman,
        isYakuman: false,
      };
    }

    // Calculate base points: fu × 2^(han+2)
    let basePoints = fu * Math.pow(2, han + 2);

    // Calculate scores
    let tsumoDealer = 0;
    let tsumoNonDealer = 0;
    let ronDealer = 0;
    let ronNonDealer = 0;

    if (isTsumo) {
      // Tsumo: dealer pays 2×base, non-dealer pays base
      if (isDealer) {
        tsumoDealer = 0; // Dealer doesn't pay themselves
        tsumoNonDealer = basePoints * 2; // Each non-dealer pays dealer
      } else {
        tsumoDealer = basePoints * 2; // Dealer pays winner
        tsumoNonDealer = basePoints; // Each non-dealer pays winner
      }
    } else {
      // Ron: dealer pays 6×base, non-dealer pays 4×base
      if (isDealer) {
        ronDealer = basePoints * 6;
        ronNonDealer = 0;
      } else {
        ronDealer = basePoints * 4;
        ronNonDealer = 0;
      }
    }

    // Round up to nearest 100
    tsumoDealer = Math.ceil(tsumoDealer / 100) * 100;
    tsumoNonDealer = Math.ceil(tsumoNonDealer / 100) * 100;
    ronDealer = Math.ceil(ronDealer / 100) * 100;
    ronNonDealer = Math.ceil(ronNonDealer / 100) * 100;

    return {
      basePoints,
      tsumoDealer,
      tsumoNonDealer,
      ronDealer,
      ronNonDealer,
      isMangan: false,
      isHaneman: false,
      isBaiman: false,
      isSanbaiman: false,
      isYakuman: false,
    };
  }, [han, fu, isTsumo, isDealer]);

  const getHandName = (): string => {
    if (!calculateScore) return '';
    if (calculateScore.isYakuman) return 'Yakuman';
    if (calculateScore.isSanbaiman) return 'Sanbaiman';
    if (calculateScore.isBaiman) return 'Baiman';
    if (calculateScore.isHaneman) return 'Haneman';
    if (calculateScore.isMangan) return 'Mangan';
    return `${han} Han ${fu} Fu`;
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Mahjong Score Calculator</h1>
          <a
            href="https://docs.google.com/document/d/1Cai2O3TsZyv3nV-gXU46I6taYoDFjlutNiOxS2n-BB0/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            title="Help: How scoring works"
          >
            <QuestionMarkCircleIcon className="h-6 w-6" />
          </a>
        </div>
        <p className="text-gray-600">
          Calculate the score for your Riichi Mahjong hand
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <CalculatorIcon className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Hand Information</h2>
          </div>

          <div className="space-y-6">
            {/* Han Input */}
            <div>
              <label htmlFor="han" className="block text-sm font-medium text-gray-700 mb-2">
                Han
              </label>
              <input
                type="number"
                id="han"
                min="1"
                max="13"
                value={han}
                onChange={(e) => setHan(Math.max(1, Math.min(13, parseInt(e.target.value) || 1)))}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of han in your hand (1-13)
              </p>
            </div>

            {/* Fu Input */}
            {han < 5 && (
                <div>
                    <label htmlFor="fu" className="block text-sm font-medium text-gray-700 mb-2">
                        Fu
                    </label>
                    <input
                        type="number"
                        id="fu"
                        min="20"
                        max="110"
                        step="10"
                        value={fu}
                        onChange={(e) => setFu(Math.max(20, Math.min(110, parseInt(e.target.value) || 30)))}
                        className="input-field"
                        disabled={han >= 5}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        {han >= 5 
                        ? 'Fu is not used for mangan and above' 
                        : 'Number of fu in your hand (20-110, typically 30, 40, 50, etc.)'}
                    </p>
                    <button type="button"
                        onClick={() => setIsFuModalOpen(true)}
                        className="mt-2 btn-secondary text-sm"
                    >
                        Calculate Fu
                    </button>
                </div>
              )}

            {/* Win Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Win Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="winType"
                    checked={isTsumo}
                    onChange={() => setIsTsumo(true)}
                    className="mr-2 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700">Tsumo (Self-draw)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="winType"
                    checked={!isTsumo}
                    onChange={() => setIsTsumo(false)}
                    className="mr-2 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700">Ron (Win by discard)</span>
                </label>
              </div>
            </div>

            {/* Dealer Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Player Status (You)
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="dealer"
                    checked={isDealer}
                    onChange={() => setIsDealer(true)}
                    className="mr-2 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700">Dealer (Oya)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="dealer"
                    checked={!isDealer}
                    onChange={() => setIsDealer(false)}
                    className="mr-2 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700">Non-Dealer</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Score Calculation</h2>

          {calculateScore ? (
            <div className="space-y-6">
              {/* Hand Name */}
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Hand</div>
                <div className="text-2xl font-bold text-primary-700">
                  {getHandName()}
                </div>
              </div>

              {/* Base Points (only for non-fixed hands) */}
              {han < 5 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Base Points</div>
                  <div className="text-xl font-semibold text-gray-900">
                    {calculateScore.basePoints.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Formula: {fu} × 2<sup>{han + 2}</sup> = {calculateScore.basePoints.toLocaleString()}
                  </div>
                </div>
              )}

              {/* Tsumo Scores */}
              {isTsumo && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Tsumo Scores</h3>
                  
                  {isDealer ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-2">From each non-dealer:</div>
                      <div className="text-2xl font-bold text-green-700">
                        {calculateScore.tsumoNonDealer.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Total received: {(calculateScore.tsumoNonDealer * 3).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-2">From dealer:</div>
                        <div className="text-2xl font-bold text-green-700">
                          {calculateScore.tsumoDealer.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-2">From each non-dealer:</div>
                        <div className="text-2xl font-bold text-blue-700">
                          {calculateScore.tsumoNonDealer.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-2">Total received:</div>
                        <div className="text-xl font-bold text-gray-900">
                          {(calculateScore.tsumoDealer + calculateScore.tsumoNonDealer * 2).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ron Scores */}
              {!isTsumo && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Ron Score</h3>
                  
                  {isDealer ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-2">From discarder:</div>
                      <div className="text-2xl font-bold text-green-700">
                        {calculateScore.ronDealer.toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-2">From discarder:</div>
                      <div className="text-2xl font-bold text-green-700">
                        {calculateScore.ronNonDealer.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Scoring Rules Info */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm font-medium text-yellow-800 mb-2">Scoring Rules:</div>
                <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                  {isTsumo ? (
                    <>
                      <li>Dealer tsumo: Each non-dealer pays 2× base points</li>
                      <li>Non-dealer tsumo: Dealer pays 2× base, each non-dealer pays 1× base</li>
                    </>
                  ) : (
                    <>
                      <li>Dealer ron: Discarder pays 6× base points</li>
                      <li>Non-dealer ron: Discarder pays 4× base points</li>
                    </>
                  )}
                  <li>5+ han: Fixed values (mangan, haneman, baiman, sanbaiman, yakuman)</li>
                  <li>All scores are rounded up to the nearest 100</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Please enter valid han and fu values
            </div>
          )}
        </div>
      </div>

      {/* Fu Calculator Modal */}
      <FuCalculatorModal
        isOpen={isFuModalOpen}
        onClose={() => setIsFuModalOpen(false)}
        onSave={(calculatedFu) => setFu(calculatedFu)}
        currentTsumo={isTsumo}
        hanCount={han}
      />
    </div>
  );
};

export default ScoreCalculator;

