// 数值部分：仅接受整数/小数的数字字面量（如 1000、1.5、.5）
const SIZE_NUMBER_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * 将表示数据大小的字符串（如 '1.5GB'、'512 MiB'、'2t'）转换为字节数。
 * 语法为「数字 + 可选单位」：数字支持整数和小数；单位大小写不敏感，
 * 支持 G / GB / GiB 形式（B/Byte(s)、K/KB/KiB、M/MB/MiB、G/GB/GiB、T/TB/TiB、P/PB/PiB，最大单位 PB）。
 * 仅输入数字时按字节处理；仅输入单位（如 'kb'）视为 1 个单位。
 * 不使用 eval / Function，兼容严格 CSP（无 'unsafe-eval'）。
 * @param str - 输入的字符串。
 * @returns - 计算出的字节数（number）；空字符串返回 0（表示"无限制"）；无法解析返回 null。
 * @example
 * stringToBytes('1MB');        // 1048576
 * stringToBytes('1 MB');       // 1048576
 * stringToBytes('5.4MB');      // 5662310
 * stringToBytes('1.5 GiB');    // 1610612736
 * stringToBytes('2t');         // 2199023255552
 * stringToBytes('1024');       // 1024 (默认为字节)
 * stringToBytes('kb');         // 1024 (等价于 1 KB)
 * stringToBytes('');           // 0 (无限制)
 * stringToBytes('abc');        // null (无法解析)
 */
export function stringToBytes(str: string): number | null {
  if (typeof str !== "string" || str.trim() === "") {
    return 0;
  }
  // 定义单位和它们的字节倍数 (使用 1024 为基数，最大单位 PB)
  const units: { [key: string]: number } = {
    b: 1,
    byte: 1,
    bytes: 1,
    k: 1024,
    kb: 1024,
    ki: 1024,
    kib: 1024,
    kilobyte: 1024,
    m: 1024 ** 2,
    mb: 1024 ** 2,
    mi: 1024 ** 2,
    mib: 1024 ** 2,
    megabyte: 1024 ** 2,
    g: 1024 ** 3,
    gb: 1024 ** 3,
    gi: 1024 ** 3,
    gib: 1024 ** 3,
    gigabyte: 1024 ** 3,
    t: 1024 ** 4,
    tb: 1024 ** 4,
    ti: 1024 ** 4,
    tib: 1024 ** 4,
    terabyte: 1024 ** 4,
    p: 1024 ** 5,
    pb: 1024 ** 5,
    pi: 1024 ** 5,
    pib: 1024 ** 5,
    petabyte: 1024 ** 5,
  };

  // 1. 预处理字符串：转小写，移除逗号和空格
  const cleanStr = str.toLowerCase().replace(/,/g, "").replace(/\s/g, "");

  // 2. 分离单位和数值
  // 按长度降序排序单位，以优先匹配长单位（如 'kb' 而不是 'b'）
  const unitKeys = Object.keys(units).sort((a, b) => b.length - a.length);
  const unitRegex = new RegExp(`(${unitKeys.join("|")})$`);

  let unit = "b"; // 默认为 byte
  let numericPart = cleanStr;

  const match = cleanStr.match(unitRegex);
  if (match) {
    unit = match[1];
    // 从字符串中移除单位，得到纯数值部分
    numericPart = cleanStr.substring(0, cleanStr.length - unit.length);
  }

  // 如果数值部分为空（例如输入 "kb"），则认为数值是 1
  if (numericPart === "") {
    numericPart = "1";
  }

  // 3. 解析数值部分：仅接受数字字面量，不执行任何代码
  if (!SIZE_NUMBER_PATTERN.test(numericPart)) {
    return null;
  }
  const value = Number(numericPart);
  if (!Number.isFinite(value)) {
    return null;
  }

  // 4. 乘以单位对应的倍数
  const result = Math.round(value * units[unit]);
  return Number.isFinite(result) ? result : null;
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  if (unitIndex === 0) {
    // 单位为B，不显示小数
    return `${Math.round(size)} ${units[unitIndex]}`;
  } else if (unitIndex >= 2 && bytes >= 1024**3) {
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  } else if (size > 99.99) {
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  } else {
    // 小于等于两位数，显示2位小数
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
