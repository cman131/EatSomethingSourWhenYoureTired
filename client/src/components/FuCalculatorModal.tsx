import React, { useState, useMemo, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface FuCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fu: number) => void;
  currentTsumo: boolean;
  hanCount: number;
}

const FuCalculatorModal: React.FC<FuCalculatorModalProps> = ({ isOpen, onClose, onSave, currentTsumo, hanCount }) => {
  const [isChitoitsu, setIsChitoitsu] = useState<boolean>(false);
  const [isPinfu, setIsPinfu] = useState<boolean>(false);
  const [isOpenPinfu, setIsOpenPinfu] = useState<boolean>(false);
  const [isHandOpen, setIsHandOpen] = useState<boolean>(false);
  const [waitType, setWaitType] = useState<'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shabo' | 'none'>('none');
  const [pairType, setPairType] = useState<'none' | 'dragon' | 'seatWind' | 'roundWind' | 'bothWinds'>('none');
  const [openTripletsSimples, setOpenTripletsSimples] = useState<string>('0');
  const [closedTripletsSimples, setClosedTripletsSimples] = useState<string>('0');
  const [openTripletsHonors, setOpenTripletsHonors] = useState<string>('0');
  const [closedTripletsHonors, setClosedTripletsHonors] = useState<string>('0');
  const [openKansSimples, setOpenKansSimples] = useState<string>('0');
  const [closedKansSimples, setClosedKansSimples] = useState<string>('0');
  const [openKansHonors, setOpenKansHonors] = useState<string>('0');
  const [closedKansHonors, setClosedKansHonors] = useState<string>('0');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsChitoitsu(false);
      setIsPinfu(false);
      setIsOpenPinfu(false);
      setIsHandOpen(false);
      setWaitType('none');
      setPairType('none');
      setOpenTripletsSimples('0');
      setClosedTripletsSimples('0');
      setOpenTripletsHonors('0');
      setClosedTripletsHonors('0');
      setOpenKansSimples('0');
      setClosedKansSimples('0');
      setOpenKansHonors('0');
      setClosedKansHonors('0');
    }
  }, [isOpen]);

  const isFormSimplified = useMemo(() => {
    return isChitoitsu || isPinfu || isOpenPinfu;
  }, [isChitoitsu, isPinfu, isOpenPinfu]);

  const calculateFu = useMemo((): number => {
    // Seven pairs is always 25 fu
    if (isChitoitsu) {
      return 25;
    }

    // Pinfu is always 20 fu (only possible with tsumo)
    if (isPinfu && currentTsumo) {
      return 20;
    }

    // Open pinfu is always 30 or 20 fu (only possible with 1 han)
    if (isOpenPinfu) {
      return hanCount === 1 ? 30 : 20;
    }

    // Base fu: 30 if ron (not tsumo) and hand is closed, 20 otherwise
    let totalFu = (!currentTsumo && !isHandOpen) ? 30 : 20;

    // Wait type fu
    if (waitType === 'kanchan' || waitType === 'penchan' || waitType === 'tanki') {
      totalFu += 2;
    }

    // Pair type fu
    if (pairType === 'dragon' || pairType === 'seatWind' || pairType === 'roundWind') {
      totalFu += 2;
    } else if (pairType === 'bothWinds') {
      totalFu += 4;
    }

    // Meld fu
    // Triplets: simples +2 (open) / +4 (closed), honors/terminals +4 (open) / +8 (closed)
    // Treat empty strings as 0
    const openTripletsSimplesNum = openTripletsSimples === '' ? 0 : parseInt(openTripletsSimples, 10) || 0;
    const closedTripletsSimplesNum = closedTripletsSimples === '' ? 0 : parseInt(closedTripletsSimples, 10) || 0;
    const openTripletsHonorsNum = openTripletsHonors === '' ? 0 : parseInt(openTripletsHonors, 10) || 0;
    const closedTripletsHonorsNum = closedTripletsHonors === '' ? 0 : parseInt(closedTripletsHonors, 10) || 0;
    const openKansSimplesNum = openKansSimples === '' ? 0 : parseInt(openKansSimples, 10) || 0;
    const closedKansSimplesNum = closedKansSimples === '' ? 0 : parseInt(closedKansSimples, 10) || 0;
    const openKansHonorsNum = openKansHonors === '' ? 0 : parseInt(openKansHonors, 10) || 0;
    const closedKansHonorsNum = closedKansHonors === '' ? 0 : parseInt(closedKansHonors, 10) || 0;
    
    totalFu += openTripletsSimplesNum * 2;
    totalFu += closedTripletsSimplesNum * 4;
    totalFu += openTripletsHonorsNum * 4;
    totalFu += closedTripletsHonorsNum * 8;
    // Kans: simples +8 (open) / +16 (closed), honors/terminals +16 (open) / +32 (closed)
    totalFu += openKansSimplesNum * 8;
    totalFu += closedKansSimplesNum * 16;
    totalFu += openKansHonorsNum * 16;
    totalFu += closedKansHonorsNum * 32;

    // Tsumo fu (2 fu, unless pinfu)
    if (currentTsumo && !isPinfu) {
      totalFu += 2;
    }

    // Round up to nearest 10
    return Math.ceil(totalFu / 10) * 10;
  }, [isChitoitsu, isPinfu, isOpenPinfu, hanCount, isHandOpen, waitType, pairType, openTripletsSimples, closedTripletsSimples, openTripletsHonors, closedTripletsHonors, openKansSimples, closedKansSimples, openKansHonors, closedKansHonors, currentTsumo]);

  const handleSave = () => {
    onSave(calculateFu);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Calculate total melds (triplets + kans)
  // Treat empty strings as 0
  const getTotalMelds = useMemo(() => {
    const openTripletsSimplesNum = openTripletsSimples === '' ? 0 : parseInt(openTripletsSimples, 10) || 0;
    const closedTripletsSimplesNum = closedTripletsSimples === '' ? 0 : parseInt(closedTripletsSimples, 10) || 0;
    const openTripletsHonorsNum = openTripletsHonors === '' ? 0 : parseInt(openTripletsHonors, 10) || 0;
    const closedTripletsHonorsNum = closedTripletsHonors === '' ? 0 : parseInt(closedTripletsHonors, 10) || 0;
    const openKansSimplesNum = openKansSimples === '' ? 0 : parseInt(openKansSimples, 10) || 0;
    const closedKansSimplesNum = closedKansSimples === '' ? 0 : parseInt(closedKansSimples, 10) || 0;
    const openKansHonorsNum = openKansHonors === '' ? 0 : parseInt(openKansHonors, 10) || 0;
    const closedKansHonorsNum = closedKansHonors === '' ? 0 : parseInt(closedKansHonors, 10) || 0;
    
    return openTripletsSimplesNum + closedTripletsSimplesNum + 
           openTripletsHonorsNum + closedTripletsHonorsNum +
           openKansSimplesNum + closedKansSimplesNum +
           openKansHonorsNum + closedKansHonorsNum;
  }, [openTripletsSimples, closedTripletsSimples, openTripletsHonors, closedTripletsHonors, 
      openKansSimples, closedKansSimples, openKansHonors, closedKansHonors]);

  // Helper function to handle meld input changes with validation
  const handleMeldChange = (
    value: string,
    currentValue: string,
    setter: (value: string) => void
  ) => {
    // Allow empty string
    if (value === '') {
      setter('');
      return;
    }
    
    // Only allow numeric digits
    if (!/^\d+$/.test(value)) {
      return;
    }
    
    const numValue = parseInt(value, 10);
    const currentNumValue = currentValue === '' ? 0 : parseInt(currentValue, 10) || 0;
    const otherMeldsTotal = getTotalMelds - currentNumValue;
    const maxAllowed = Math.max(0, Math.min(4, 4 - otherMeldsTotal));
    const finalValue = Math.max(0, Math.min(maxAllowed, numValue));
    setter(finalValue.toString());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleCancel}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Fu Calculator</h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Hand Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Hand Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isChitoitsu}
                      onChange={(e) => {
                        setIsChitoitsu(e.target.checked);
                        if (e.target.checked) {
                          setIsPinfu(false);
                          setIsOpenPinfu(false);
                        }
                      }}
                      className="mr-2 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">Seven Pairs (Chitoitsu) - Always 25 fu</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isPinfu}
                      onChange={(e) => {
                        setIsPinfu(e.target.checked);
                        if (e.target.checked) {
                          setIsChitoitsu(false);
                          setIsOpenPinfu(false);
                        }
                      }}
                      disabled={!currentTsumo}
                      className="mr-2 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span className="text-gray-700">
                      Pinfu Tsumo (Both Yaku) - Always 20 fu {!currentTsumo && '(Tsumo only)'}
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isOpenPinfu}
                      onChange={(e) => {
                        setIsOpenPinfu(e.target.checked);
                        if (e.target.checked) {
                          setIsChitoitsu(false);
                          setIsPinfu(false);
                        }
                      }}
                      className="mr-2 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span className="text-gray-700">
                      All Sequences (Open Pinfu Shape) - Makes minimum hand 1 han 30 fu
                    </span>
                  </label>
                </div>
              </div>

              {/* Hand Open/Closed */}
              {!isFormSimplified && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Hand Status
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isHandOpen}
                      onChange={(e) => setIsHandOpen(e.target.checked)}
                      className="mr-2 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">Hand is open (melds were called)</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Closed hand with ron: base 30 fu. Open hand or tsumo: base 20 fu.
                  </p>
                </div>
              )}

              {/* Wait Type */}
              {!isFormSimplified && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wait Type
                  </label>
                  <select
                    value={waitType}
                    onChange={(e) => setWaitType(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="none">Other wait (Open or Single waits) - 0 fu</option>
                    <option value="kanchan">Gap/Closed wait (4,6 for a 5) - 2 fu</option>
                    <option value="penchan">Edge wait (8,9 for a 7) - 2 fu</option>
                    <option value="tanki">Pair wait (7 for a 7) - 2 fu</option>
                  </select>
                </div>
              )}

              {/* Pair Type */}
              {!isFormSimplified && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pair Type
                  </label>
                  <select
                    value={pairType}
                    onChange={(e) => setPairType(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="none">No special pair - 0 fu</option>
                    <option value="dragon">Dragon pair - 2 fu</option>
                    <option value="seatWind">Seat wind pair - 2 fu</option>
                    <option value="roundWind">Round wind pair - 2 fu</option>
                    <option value="bothWinds">Both seat and round wind - 4 fu</option>
                  </select>
                </div>
              )}

              {/* Melds */}
              {!isFormSimplified && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-gray-700">
                      Total Melds: <span className={`font-semibold ${getTotalMelds > 4 ? 'text-red-600' : getTotalMelds === 4 ? 'text-green-600' : 'text-gray-900'}`}>
                        {getTotalMelds} / 4
                      </span>
                    </div>
                    {getTotalMelds > 4 && (
                      <p className="text-xs text-red-600 mt-1">Maximum 4 melds allowed in a hand</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Triplets</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Open Triplets of Simples (2 fu each)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={openTripletsSimples}
                          onChange={(e) => handleMeldChange(e.target.value, openTripletsSimples, setOpenTripletsSimples)}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Closed Triplets of Simples (4 fu each)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={closedTripletsSimples}
                          onChange={(e) => handleMeldChange(e.target.value, closedTripletsSimples, setClosedTripletsSimples)}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Open Triplets of Honors/Terminals (4 fu each)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={openTripletsHonors}
                          onChange={(e) => handleMeldChange(e.target.value, openTripletsHonors, setOpenTripletsHonors)}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Closed Triplets of Honors/Terminals (8 fu each)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={closedTripletsHonors}
                          onChange={(e) => handleMeldChange(e.target.value, closedTripletsHonors, setClosedTripletsHonors)}
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Kans (Quads)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Open Kans of Simples (8 fu each)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={openKansSimples}
                          onChange={(e) => handleMeldChange(e.target.value, openKansSimples, setOpenKansSimples)}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Closed Kans of Simples (16 fu each)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={closedKansSimples}
                          onChange={(e) => handleMeldChange(e.target.value, closedKansSimples, setClosedKansSimples)}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Open Kans of Honors/Terminals (16 fu each)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={openKansHonors}
                          onChange={(e) => handleMeldChange(e.target.value, openKansHonors, setOpenKansHonors)}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Closed Kans of Honors/Terminals (32 fu each)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={closedKansHonors}
                          onChange={(e) => handleMeldChange(e.target.value, closedKansHonors, setClosedKansHonors)}
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Calculated Fu Display */}
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Calculated Fu</div>
                    <div className="text-2xl font-bold text-primary-700">
                      {calculateFu}
                    </div>
                  </div>
                  <div className="border-t border-primary-200 pt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Han:</span>
                      <span className="font-semibold text-gray-900">{hanCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Win Type:</span>
                      <span className="font-semibold text-gray-900">
                        {currentTsumo ? 'Tsumo' : 'Ron'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSave}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FuCalculatorModal;

