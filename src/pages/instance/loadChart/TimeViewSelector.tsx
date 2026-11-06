import { SegmentedControl } from "@radix-ui/themes";
import type { TimeView } from "./types";

type TimeViewSelectorProps = {
  timeViews: TimeView[];
  value: string;
  onChange: (key: string) => void;
};

/** 时间范围预设（实时 / 10 分钟 / … / 自定义），窄屏时横向滚动 */
const TimeViewSelector = ({ timeViews, value, onChange }: TimeViewSelectorProps) => (
  <div className="w-full overflow-x-auto">
    <div className="w-max mx-auto">
      <SegmentedControl.Root value={value} onValueChange={onChange}>
        {timeViews.map((view) => (
          <SegmentedControl.Item key={view.key} value={view.key} className="capitalize">
            {view.label}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </div>
  </div>
);

export default TimeViewSelector;
