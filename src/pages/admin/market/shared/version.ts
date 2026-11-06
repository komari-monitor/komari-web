function parseLooseVersion(value: string) {
  const match = value
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return match
    ? [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)]
    : null;
}

/** 市场版本是否比已安装版本新；无法解析时只要不同就视为有更新 */
export function isVersionNewer(candidate: string, installed: string) {
  const next = parseLooseVersion(candidate);
  const current = parseLooseVersion(installed);
  if (!next || !current) return candidate !== installed;
  for (let index = 0; index < next.length; index += 1) {
    if (next[index] !== current[index]) return next[index] > current[index];
  }
  return false;
}

/** 插件声明的 komari 版本约束（>=、<=、>、<、= 或裸版本号）是否满足当前版本 */
export function isKomariCompatible(constraint: string | undefined, current: string) {
  const parse = (value: string): [number, number, number] | null => {
    const parts = value.trim().replace(/^v/, "").split(".");
    if (
      parts.length > 3 ||
      parts.some((part) => part === "" || !/^\d+$/.test(part))
    ) {
      return null;
    }
    return [0, 1, 2].map((index) => Number(parts[index] || 0)) as [
      number,
      number,
      number,
    ];
  };
  const currentVersion = parse(current);
  const requirement = (constraint || "").trim();
  if (!requirement || !currentVersion) return true;

  let operator = "";
  let version = requirement;
  for (const candidate of [">=", "<=", ">", "<", "="]) {
    if (version.startsWith(candidate)) {
      operator = candidate;
      version = version.slice(candidate.length).trim();
      break;
    }
  }
  const requiredVersion = parse(version);
  if (!requiredVersion) return false;

  let comparison = 0;
  for (let index = 0; index < 3; index += 1) {
    if (currentVersion[index] !== requiredVersion[index]) {
      comparison = currentVersion[index] > requiredVersion[index] ? 1 : -1;
      break;
    }
  }
  switch (operator) {
    case ">=":
      return comparison >= 0;
    case ">":
      return comparison > 0;
    case "<=":
      return comparison <= 0;
    case "<":
      return comparison < 0;
    default:
      return comparison === 0;
  }
}
