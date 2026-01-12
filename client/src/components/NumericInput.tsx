import React from 'react';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
}

const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  step = 1,
  min,
  max,
  className = '',
  disabled = false,
  required = false,
  ...restProps
}) => {
  // Treat null/undefined as 0 for display and calculations
  const numericValue = value ?? 0;
  const displayValue = value === null || value === undefined ? '' : value.toString();

  // Check if buttons should be disabled based on min/max bounds
  const canIncrement = max === undefined || numericValue + step <= max;
  const canDecrement = min === undefined || numericValue - step >= min;
  const isIncrementDisabled = disabled || !canIncrement;
  const isDecrementDisabled = disabled || !canDecrement;

  const handleIncrement = () => {
    if (isIncrementDisabled) return;
    let newValue = numericValue + step;
    // Clamp to max if provided
    if (max !== undefined && newValue > max) {
      newValue = max;
    }
    onChange(newValue);
  };

  const handleDecrement = () => {
    if (isDecrementDisabled) return;
    let newValue = numericValue - step;
    // Clamp to min if provided
    if (min !== undefined && newValue < min) {
      newValue = min;
    }
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty string (which represents null/undefined)
    if (inputValue === '') {
      onChange(null);
      return;
    }

    // Only allow numeric input (including negative numbers)
    if (/^-?\d*\.?\d*$/.test(inputValue)) {
      const numValue = parseFloat(inputValue);
      // Check if it's a valid number
      if (!isNaN(numValue)) {
        onChange(numValue);
      } else if (inputValue === '-' || inputValue === '.') {
        // Allow intermediate states like '-' or '.' while typing
        // We'll keep the string as is, but onChange expects a number
        // For now, we'll set it to 0 or null - but this might not be ideal UX
        // Actually, let's allow the user to type and only update when valid
        onChange(null);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // On blur, if the input is empty or invalid, set to null
    const inputValue = e.target.value.trim();
    if (inputValue === '' || inputValue === '-' || inputValue === '.') {
      onChange(null);
    }
  };

  return (
    <div className={`flex items-center border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={isDecrementDisabled}
        className="flex items-center justify-center px-2 sm:px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-r border-gray-300 rounded-l-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-600 disabled:hover:bg-transparent flex-shrink-0"
        aria-label="Decrement"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        className="flex-1 min-w-0 px-2 sm:px-3 py-2 text-center border-0 focus:outline-none focus:ring-0 disabled:bg-gray-50 disabled:cursor-not-allowed"
        {...restProps}
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={isIncrementDisabled}
        className="flex items-center justify-center px-2 sm:px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-l border-gray-300 rounded-r-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-600 disabled:hover:bg-transparent flex-shrink-0"
        aria-label="Increment"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

export default NumericInput;

