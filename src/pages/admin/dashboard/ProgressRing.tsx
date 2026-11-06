import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";

/** 在线率圆环 */
export const ProgressRing = ({
  percent,
  color,
  ariaLabel,
}: {
  percent: number;
  color: "green" | "red" | "orange" | "gray";
  ariaLabel?: string;
}) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <svg
      width="104"
      height="104"
      viewBox="0 0 104 104"
      style={{ flex: "none" }}
      role="img"
      aria-label={ariaLabel}
    >
      <circle
        cx="52"
        cy="52"
        r={radius}
        fill="none"
        stroke="var(--gray-5)"
        strokeWidth="10"
      />
      <circle
        cx="52"
        cy="52"
        r={radius}
        fill="none"
        stroke={`var(--${color}-9)`}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        transform="rotate(-90 52 52)"
        style={{
          transition: `stroke-dashoffset ${MOTION_DURATION.slow}s ${MOTION_EASE.out}`,
        }}
      />
      <text
        x="52"
        y="59"
        textAnchor="middle"
        fontSize="20"
        fontWeight="bold"
        fill="currentColor"
      >
        {clamped.toFixed(0)}%
      </text>
    </svg>
  );
};
