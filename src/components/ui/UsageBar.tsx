import { Progress } from "@/components/ui/progress";

interface UsageBarProps {
  value: number;
  label: string;
}

const UsageBar = ({ value, label }: UsageBarProps) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  const getIndicatorColorClass = (val: number) => {
    if (val >= 80) return 'bg-red-600';
    if (val >= 60) return 'bg-orange-500';
    return 'bg-green-600';
  };

  const indicatorColorClass = getIndicatorColorClass(clampedValue);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium">
          {clampedValue.toFixed(1)}%
        </p>
      </div>
      <Progress
        value={clampedValue}
        className="w-full h-[8px] rounded-[4px]"
        indicatorClassName={indicatorColorClass}
      />
    </div>
  );
};

export default UsageBar;