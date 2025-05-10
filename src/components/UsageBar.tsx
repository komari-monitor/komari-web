import { Box, Flex, Text } from '@radix-ui/themes';
import { motion } from 'framer-motion'; // For smooth animations

interface UsageBarProps {
  value: number; // Utilization percentage (0–100)
  label: string; // Label for the bar (e.g., "CPU", "Memory", "Disk")
}

const UsageBar = ({ value, label }: UsageBarProps) => {
  // Ensure value is between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);

  // Determine color based on thresholds
  const getColor = (val: number) => {
    if (val >= 80) return 'red';
    if (val >= 60) return 'orange';
    return 'green';
  };

  const barColor = getColor(clampedValue);

  return (
    <Flex direction="column" gap="1" style={{ width: '100%' }}>
      <Flex justify="between" align="center">
        <Text size="2" color="gray">
          {label}
        </Text>
        <Text size="2" weight="medium">
          {clampedValue.toFixed(1)}%
        </Text>
      </Flex>
      <Box
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--gray-5)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{
            height: '100%',
            backgroundColor: `var(--${barColor}-9)`,
            borderRadius: '4px',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </Box>
    </Flex>
  );
};

export default UsageBar;