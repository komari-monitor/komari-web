import React from "react";
import { Collapse } from "@/components/motion";

/**
 * 勾选后才出现的输入框：高度弹簧展开/收起（同一个元素，快速连点可打断），
 * 收起时 inert，不进 Tab 顺序。负 margin 抵消父级 flex gap，收起后不留空隙，展开后与原来间距一致。
 */
const OptionField = ({
  open,
  children,
  gap = "var(--space-2)",
}: {
  open: boolean;
  children: React.ReactNode;
  gap?: string;
}) => (
  <Collapse
    open={open}
    inert={!open || undefined}
    aria-hidden={!open || undefined}
    style={{ marginTop: `calc(-1 * ${gap})` }}
  >
    <div style={{ paddingTop: gap }}>{children}</div>
  </Collapse>
);

export default OptionField;
