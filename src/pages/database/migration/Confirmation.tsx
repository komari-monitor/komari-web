import { Checkbox, Text } from "@radix-ui/themes";

export default function Confirmation({
  checked,
  onCheckedChange,
  color,
  description,
  label,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  color: "amber" | "red";
  description: string;
  label: string;
}) {
  return (
    <label
      className="flex items-start gap-km-group border p-km-block"
      style={{
        borderColor: `var(--${color}-a6)`,
        background: `var(--${color}-a2)`,
        borderRadius: "var(--radius-2)",
      }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        mt="1"
      />
      <span>
        <Text as="div" size="2">
          {description}
        </Text>
        <Text as="div" size="2" weight="bold" mt="1">
          {label}
        </Text>
      </span>
    </label>
  );
}
