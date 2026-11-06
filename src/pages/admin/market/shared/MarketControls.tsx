import { Button, Callout, IconButton, TextField } from "@radix-ui/themes";
import { AlertTriangle, RefreshCw, Search, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import type { MarketSourceStatus } from "./types";

interface MarketHeaderActionsProps {
  onManageSources: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  manageIconSize: number;
  refreshIconSize: number;
}

/** 页头右侧：「管理源」按钮 + 刷新目录图标按钮 */
export function MarketHeaderActions({
  onManageSources,
  onRefresh,
  refreshing,
  manageIconSize,
  refreshIconSize,
}: MarketHeaderActionsProps) {
  const { t } = useTranslation();
  return (
    <>
      <Button variant="soft" onClick={onManageSources}>
        <Settings2 size={manageIconSize} />
        {t("market.manage_sources", "Manage sources")}
      </Button>
      <IconButton variant="soft" onClick={onRefresh} disabled={refreshing} title={t("common.refresh", "Refresh")}>
        <RefreshCw size={refreshIconSize} className={refreshing ? "animate-spin" : ""} />
      </IconButton>
    </>
  );
}

interface MarketSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className: string;
  iconSize: number;
  size?: "3";
}

/** 目录搜索框 */
export function MarketSearch({ value, onChange, placeholder, className, iconSize, size }: MarketSearchProps) {
  return (
    <TextField.Root
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      {...(size ? { size } : {})}
      className={className}
    >
      <TextField.Slot><Search size={iconSize} /></TextField.Slot>
    </TextField.Root>
  );
}

/** feedback 层：源错误在刷新后出现/消失时高度展开/收起，下方网格不跳 */
export function MarketSourceErrors({ statuses }: { statuses: MarketSourceStatus[] }) {
  return (
    <AnimatePresence initial={false}>
      {statuses.filter((source) => source.error).map((source) => (
        <motion.div
          key={source.id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: MOTION_SPRING.soft, opacity: MOTION_TRANSITION.fade }}
          style={{ overflow: "hidden" }}
        >
        <Callout.Root color="red" size="1">
          <Callout.Icon><AlertTriangle size={16} /></Callout.Icon>
          <Callout.Text>{source.name}: {source.error}</Callout.Text>
        </Callout.Root>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
