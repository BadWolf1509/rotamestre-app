import React from 'react';
import { View, StyleSheet } from 'react-native';

interface SliderProps {
  style?: object;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * Web-compatible Slider component using native HTML input[type="range"]
 * Provides the same interface as @react-native-community/slider
 */
export default function Slider({
  style,
  minimumValue = 0,
  maximumValue = 1,
  step = 0,
  value = 0,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor = '#007AFF',
  maximumTrackTintColor = '#d1d5db',
  thumbTintColor = '#007AFF',
  disabled = false,
  testID,
}: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onValueChange?.(newValue);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const newValue = parseFloat(target.value);
    onSlidingComplete?.(newValue);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const newValue = parseFloat(target.value);
    onSlidingComplete?.(newValue);
  };

  // Calculate the percentage for styling the track
  const percentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;

  return (
    <View style={[styles.container, style]}>
      <input
        type="range"
        min={minimumValue}
        max={maximumValue}
        step={step || 'any'}
        value={value}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleTouchEnd}
        disabled={disabled}
        data-testid={testID}
        style={{
          width: '100%',
          height: 40,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          // Custom styling using CSS variables
          background: `linear-gradient(to right, ${minimumTrackTintColor} 0%, ${minimumTrackTintColor} ${percentage}%, ${maximumTrackTintColor} ${percentage}%, ${maximumTrackTintColor} 100%)`,
          borderRadius: 4,
          outline: 'none',
          WebkitAppearance: 'none',
          appearance: 'none' as const,
        }}
        className="slider-web"
      />
      <style>{`
        .slider-web::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${thumbTintColor};
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .slider-web::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${thumbTintColor};
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .slider-web::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 4px;
        }
        .slider-web::-moz-range-track {
          height: 8px;
          border-radius: 4px;
        }
      `}</style>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
  },
});
