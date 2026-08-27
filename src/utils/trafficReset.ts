/**
 * 流量重置日倒计时工具
 * 参考: https://github.com/nuomiiiii/nezha (src/lib/trafficReset.ts)
 *
 * 重置日来源: 服务器标签中的 <TRD:n> 元标签
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 计算指定年份月份中重置日对应的实际日期。
 * 若重置日超出当月天数（如2月的31日），则回退到次月1日。
 */
function actualResetDate(year: number, month: number, resetDay: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  if (resetDay <= lastDay) return new Date(year, month, resetDay);
  return new Date(year, month + 1, 1);
}

function sameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function calendarDayDistance(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.round((toUTC - fromUTC) / DAY_MS));
}

/**
 * 计算距离下次流量重置还有多少天。
 *
 * @param resetDay - 每月重置日（1-31），无效值返回 undefined
 * @param now - 当前时间（用于测试覆盖）
 * @returns 剩余天数（0 = 今日重置），undefined 表示未配置
 *
 * @example
 * daysUntilTrafficReset(1, new Date('2025-01-15'))   // 17
 * daysUntilTrafficReset(1, new Date('2025-02-01'))   // 0
 * daysUntilTrafficReset(31, new Date('2025-02-15')) // 14（2月无31日，回退到3月1日）
 */
export function daysUntilTrafficReset(
  resetDay?: number,
  now: Date = new Date(),
): number | undefined {
  if (
    !Number.isInteger(resetDay) ||
    !resetDay ||
    resetDay < 1 ||
    resetDay > 31
  ) {
    return undefined;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = actualResetDate(
    today.getFullYear(),
    today.getMonth(),
    resetDay,
  );
  const previousMonth = actualResetDate(
    today.getFullYear(),
    today.getMonth() - 1,
    resetDay,
  );

  if (sameCalendarDay(today, thisMonth) || sameCalendarDay(today, previousMonth)) {
    return 0;
  }
  if (today < thisMonth) {
    return calendarDayDistance(today, thisMonth);
  }

  const nextMonth = actualResetDate(
    today.getFullYear(),
    today.getMonth() + 1,
    resetDay,
  );
  return calendarDayDistance(today, nextMonth);
}

/**
 * 从服务器标签中解析 <TRD:n> 元标签，提取流量重置日。
 * 标签格式参考 nezha 主题：在服务器标签中加入 <TRD:1> 表示每月1日重置。
 *
 * @param tags - 服务器标签字符串，多个标签以 ';' 分隔
 * @returns 重置日（1-31），未找到返回 undefined
 *
 * @example
 * parseTRDFromTags("So-net<red>;1Gbps<green>;<TRD:1>")  // 1
 * parseTRDFromTags("So-net;<TRD:15>")                   // 15
 * parseTRDFromTags("no-trd-here")                       // undefined
 */
export function parseTRDFromTags(tags?: string): number | undefined {
  if (!tags || tags.trim() === "") return undefined;

  const tagList = tags.split(";");
  for (const tag of tagList) {
    const match = tag.trim().match(/^<TRD:(\d+)>$/i);
    if (match) {
      const day = parseInt(match[1], 10);
      if (day >= 1 && day <= 31) return day;
    }
  }
  return undefined;
}
