// 规范化版本为 [major, minor, patch] 数组，忽略前缀 v 和后缀
export function parseSemver(input?: string | null): number[] | null {
  if (!input) return null;
  const s = String(input).trim().replace(/^v/i, "");
  const match = s.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewerVersion(latest?: string | null, current?: string | null) {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}
