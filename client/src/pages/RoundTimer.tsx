import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const RoundTimer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const startDateParam = searchParams.get('startDate');
  const durationParam = searchParams.get('duration');

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    if (!startDateParam || !durationParam) {
      setIsValid(false);
      return;
    }

    const startDate = new Date(startDateParam);
    const durationMs = parseInt(durationParam, 10) * 60 * 1000;

    if (isNaN(startDate.getTime()) || isNaN(durationMs)) {
      setIsValid(false);
      return;
    }

    const projectedEnd = new Date(startDate.getTime() + durationMs);

    const updateTimer = () => {
      const now = new Date();
      setTimeRemaining(projectedEnd.getTime() - now.getTime());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startDateParam, durationParam]);

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white text-2xl">Invalid timer parameters</p>
      </div>
    );
  }

  const formatTime = (ms: number): string => {
    const isNegative = ms < 0;
    const absMs = Math.abs(ms);
    const totalSeconds = Math.floor(absMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const sign = isNegative ? '-' : '';
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isOvertime = timeRemaining !== null && timeRemaining < 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
      <p className="text-gray-400 text-2xl mb-8">Round Timer</p>
      {timeRemaining !== null && (
        <p
          className={`font-mono font-bold text-9xl ${isOvertime ? 'text-red-600' : 'text-white'}`}
        >
          {formatTime(timeRemaining)}
        </p>
      )}
      {isOvertime && (
        <p className="text-red-500 text-3xl mt-6">Overtime</p>
      )}
    </div>
  );
};

export default RoundTimer;
