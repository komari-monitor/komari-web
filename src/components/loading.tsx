import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "./Loading.css";

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

type LoadingProps = {
  children?: ReactNode;
  size?: number;
  compact?: boolean;
};

const Loading = ({ children, size, compact = false }: LoadingProps) => {
  const { t } = useTranslation();
  const [messageIndex] = useState(() =>
    Math.floor(Math.random() * messages.length),
  );
  const diameter = compact ? 16 : Math.max(16, (size ?? 5) * 10);

  return (
    <span
      role="status"
      aria-live="polite"
      className={`km-loading ${compact ? "inline-flex items-center gap-2 align-middle" : "flex flex-col items-center justify-center gap-2 py-4"}`}
    >
      <span
        className="loader shrink-0"
        style={{ width: diameter, height: diameter }}
        aria-hidden="true"
      >
        <svg className="circular" viewBox="25 25 50 50">
          <circle
            className="path"
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
