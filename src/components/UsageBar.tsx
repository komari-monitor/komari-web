import { Box, Flex, Text } from '@radix-ui/themes';
import { useEffect, useState } from 'react';

interface UsageBarProps {
  value: number; // Utilization percentage (0–100)
  label: string; // Label for the bar (e.g., "CPU", "Memory", "Disk")
  compact?: boolean; // Whether to show in compact mode (for tables)
}

const UsageBar = ({ value, label, compact = false }: UsageBarProps) => {
  // Ensure value is between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const [displayValue, setDisplayValue] = useState(0);
  
  // Animate the value change
  useEffect(() => {
    setDisplayValue(clampedValue);
  }, [clampedValue]);

  // Determine color based on thresholds
  const getColorScheme = (val: number) => {
    if (val >= 80) {
      return {
        main: 'var(--destructive)',
        gradient: 'linear-gradient(90deg, var(--chart-5), var(--destructive))',
        shadow: '0 0 8px var(--destructive)',
        text: 'var(--destructive)'
      };
    }
    if (val >= 60) {
      return {
        main: 'var(--chart-1)',
        gradient: 'linear-gradient(90deg, var(--chart-4), var(--chart-1))',
        shadow: '0 0 6px var(--chart-1)',
        text: 'var(--chart-1)'
      };
    }
    return {
      main: 'var(--chart-3)',
      gradient: 'linear-gradient(90deg, var(--chart-2), var(--chart-3))',
      shadow: 'none',
      text: 'var(--chart-3)'
    };
  };

  const colorScheme = getColorScheme(clampedValue);
  
  // Add a pulse animation for high values
  const shouldPulse = clampedValue >= 90;

  if (compact) {
    return (
      <Box style={{ width: '100%' }}>
        <Box
          className="usage-bar-container"
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'var(--accent-3)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '2px',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div
            className={`usage-bar-fill ${shouldPulse ? 'animate-pulse' : ''}`}
            style={{
              height: '100%',
              background: colorScheme.gradient,
              borderRadius: '3px',
              width: `${displayValue}%`,
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease',
              boxShadow: colorScheme.shadow,
            }}
          />
        </Box>
        <Text size="1" color="gray" className='text-sm'>
          {clampedValue.toFixed(1)}%
        </Text>
      </Box>
    );
  }

  return (
    <Flex direction="column" gap="1" style={{ width: '100%' }}>
      <Flex justify="between" align="center">
        <Text size="2" color="gray">
          {label}
        </Text>
        <Text 
          size="2" 
          weight="medium" 
          style={{ 
            color: clampedValue >= 60 ? colorScheme.text : undefined,
            transition: 'color 0.3s ease'
          }}
        >
          {clampedValue.toFixed(1)}%
        </Text>
      </Flex>
      <Box
        className="usage-bar-container"
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--accent-3)',
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          className={`usage-bar-fill ${shouldPulse ? 'animate-pulse' : ''}`}
          style={{
            height: '100%',
            background: colorScheme.gradient,
            borderRadius: '4px',
            width: `${displayValue}%`,
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease',
            boxShadow: colorScheme.shadow,
            position: 'relative',
          }}
        >
          {shouldPulse && (
            <div 
              className="absolute inset-0 opacity-30" 
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'shimmer 2s infinite',
              }}
            />
          )}
        </div>
      </Box>
    </Flex>
  );
};

export default UsageBar;
