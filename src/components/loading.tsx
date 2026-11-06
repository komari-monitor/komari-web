import { useLayoutEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "./Loading.css";
import { useRevealPending } from "@/components/motion/reveal";

const messages = [
  "Creeper, aw man",
  "⑨⑨⑨⑨⑨⑨⑨⑨⑨",
  "少女祈祷中 nowloading...",
  "sakichan●▛▙   sakichan●▛▙   sakichan●▛▙",
  "你知道吗，项目名称 Komari 取自雨森たきび创作的轻小说《败犬女主太多了！》",
  "寮長の舌欲しいな",
  "老实写代码，很枯燥对吧",
  "完熟マンゴー",
  "你愿意和我写一辈子代码吗",
  "蓝白碗赛高！",
  "立春天，风渐暖，伊人一去不复返。",
  "av170001",
  "對酒....當嗝，人生....百合",
  "Loading...",
  "Mozambique here!",
  "我 能 加 入 天 际 俯 冲",
  "“心脏要逃走了！！！！！”",
  "32123432",
  "sa↓ka→na→~     chinanako~!",
  "Komari☆探针《正在编译着色器》",
  "Hello, An internal investigation of suspicious signals associated ... "
] as const;

/*
  首屏会依次经过好几层加载（应用 Suspense -> 登录检查 -> 后台布局 -> 页面代码），每层都是一个新的 Loading。
  为了看起来是同一个「加载中」一直在转：
  - 文案每次打开页面只随机一次，所有 Loading 共用；
  - 接力：上一个还在或刚卸载（CONTINUE_MS 内）时，新的不再从透明淡入；
  - 转圈的动画按同一个时钟对齐相位，换了节点也不会从头转。
*/
const messageIndex = Math.floor(Math.random() * messages.length);
const CONTINUE_MS = 400;
let mountedLoadings = 0;
let lastLoadingUnmount = -Infinity;
/** 负的 animation-delay：让新挂载的动画从全局时钟的当前进度开始 */
const phase = (periodMs: number) => `-${Math.round(performance.now() % periodMs)}ms`;

/**
 * 历史上的形状提示。现在所有 variant 都显示原来的转圈：
 * 「按内容长相」的加载态由 Skeletonize（@/components/ui/skeleton）负责，
 * 这里保留参数只是为了兼容调用方。
 */
export type LoadingVariant =
  | "page"
  | "cards"
  | "table"
  | "chart"
  | "form"
  | "list"
  | "block"
  | "spinner";

type LoadingProps = {
  children?: ReactNode;
  size?: number;
  /** 行内的小转圈（按钮里、表格单元格里） */
  compact?: boolean;
  variant?: LoadingVariant;
  count?: number;
  height?: number;
  /**
   * 卸载时让外层 RevealBoundary 播放「内容接棒入场」。
   * 默认只有整页（不传 variant 或 variant="page"）开启：卡片里、对话框里的加载不该让整页淡一下。
   */
  reveal?: boolean;
  /** 放在已有色卡里（Skeletonize 的提示）：只要转圈和文字，不再画卡片 */
  bare?: boolean;
  className?: string;
};

const Loading = ({ children, size, compact = false, variant, reveal, bare = false, className }: LoadingProps) => {
  const { t } = useTranslation();
  const [continued] = useState(
    () => mountedLoadings > 0 || performance.now() - lastLoadingUnmount < CONTINUE_MS,
  );
  const [spin] = useState(() => ({ rotate: phase(2000), dash: phase(1500), color: phase(6000) }));
  useLayoutEffect(() => {
    mountedLoadings += 1;
    return () => {
      mountedLoadings -= 1;
      lastLoadingUnmount = performance.now();
    };
  }, []);
  useRevealPending(!bare && (reveal ?? (!compact && (variant === undefined || variant === "page"))));
  const diameter = compact ? 16 : Math.max(16, (size ?? 5) * 10);

  return (
    /*
      Loading 是 Suspense 的 fallback，而本项目有多层嵌套的 Suspense
      （App / 页面 / 列表各有一层）。给它加入场动画的话，每一层重新挂载
      都会重播一次，首屏看起来就是「加载动画抖了好几下」。
      所以这里刻意不做入场动画：转圈本身已有 CSS 动画，足够表达「在加载」。
    */
    <span
      role="status"
      aria-live="polite"
      className={`km-loading ${compact ? "inline-flex items-center gap-2 align-middle" : `flex flex-col items-center justify-center gap-2 py-4${bare ? "" : continued ? " km-loading-card km-loading-continue" : " km-loading-card"}`} ${className ?? ""}`}
    >
      <span
        className="loader shrink-0"
        style={{ width: diameter, height: diameter }}
        aria-hidden="true"
      >
        <svg className="circular" viewBox="25 25 50 50" style={{ animationDelay: spin.rotate }}>
          <circle
            className="path"
            style={{ animationDelay: `${spin.dash}, ${spin.color}` }}
            cx="50"
            cy="50"
            r="20"
            fill="none"
            strokeWidth="2"
            strokeMiterlimit="10"
          />
        </svg>
      </span>
      <span className={compact ? "text-sm" : "text-lg font-bold"}>
        {t("loading")}
      </span>
      <span
        className={
          compact
            ? "text-xs opacity-70"
            : "text-sm text-muted-foreground text-center"
        }
      >
        {messages[messageIndex]}
      </span>
      {children}
    </span>
  );
};

export default Loading;
