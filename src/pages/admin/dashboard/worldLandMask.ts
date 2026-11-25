/**
 * 180×90（2°×2°）全球陆地二值掩码 + 黄金角斐波那契球面均匀采样点。
 * 零外部依赖，仅 2 KB 原始数据，按需懒加载时只初始化一次。
 */

const MASK_WIDTH = 180;
const MASK_HEIGHT = 90;

const LAND_MASK_BASE64 =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/4H//+AAAAAAAAAAAAAAAAAAAAAAAP/j///8AAAAAAAAAAAAAAAAAAAAAAAH+H///4AAAAAAAAAAAAAAAAAAAAAAAAAB///wAAAAAAMAD/gAAAAAAAAAA/wAAA///wAAAAABwD///8AAAAAAAAAf4A/Af//gAAAAAOf//////+AAAP///v8A/wP/+AAAP8AD////////+AAf/////wP4H/wAAAf/z//////////+A//////8D8H/A+AB/////////////+A//////4AAH+AAAH8////////////8Af/////wHgD8AAAH5////////////wAfwf///gH8AAAAAHx//////////weAAOAD///wH+AAAAGBh/////////+B4AAAAA////n/AAAAGD//////////8A4AAAAAf///3/gAAAfP//////////5AwAAAAAP/////wAAAH///////////5AAAAAAAH/////4AAAB///////////9AAAAAAAD/////4AAAD///////////9AAAAAAAD////8AAAAB//4OH//////7gAAAAAAD////wAAAABx/wOH//////jgAAAAAAD////AAAAAfg/wOH/////+AAAAAAAAD///+AAAAAfATf+H/////GGAAAAAAAB///8AAAAAcAAP+H/////mOAAAAAAAB///8AAAAAH+AB//////+F8AAAAAAAAf//4AAAAAP/AB///////DAAAAAAAAAP//gAAAAAf//////////jAAAAAAAAAL/AwAAAAA/////f/////gAAAAAAAAAF/AQAAAAB///+/n/////AAAAAAAAAAB+AQAAAAB///+fgf///+gAAAAAAAAAA+AAAAAAB////f8D///8gAAAAAAAAAAeAOAAAAD////P+A/j/AAAAAAAAAAAAPcBwAAAD////v8A/D+wAAAAAAAAAAAD8AAAAAD////n4AfB/AgAAAAAAAAAAAfAAAAAH////3gAeAfAgAAAAAAAAAAADAAAAAD////0AAcAfAgAAAAAAAAAAABD4AAAB/////gAMAWAAAAAAAAAAAAAA3/AAAA/////gACAQAYAAAAAAAAAAAAH/wAAAf////gACAAAYAAAAAAAAAAAAH/8AAAAH///AAAAIGAAAAAAAAAAAAAH/+AAAAB//+AAAAkOAAAAAAAAAAAAAP/+AAAAB//8AAAAQ+AAAAAAAAAAAAAP//gAAAB//4AAAAYeQAAAAAAAAAAAAP//4AAAA//wAAAAMcw8AAAAAAAAAAAf//+AAAA//wAAAAGBgfAAAAAAAAAAAP///AAAA//wAAAADwAPgAAAAAAAAAAH///AAAA//wAAAAAAAB4AAAAAAAAAAH///AAAA//wAAAAAAAAAAAAAAAAAAAD//+AAAA//wAAAAAADxAAAAAAAAAAAB//8AAAA//xgAAAAAHxAAAAAAAAAAAA//8AAAA//xAAAAAAP/gAAAAAAAAAAAf/8AAAA//jAAAAAA//wAAAAAAAAAAAf/8AAAAf/DAAAAAD//4AAAAAAAAAAAf/4AAAAf/DAAAAAH//4AAAAAAAAAAAf/gAAAAf+CAAAAAH//8AAAAAAAAAAAf/AAAAAP8AAAAAAH//8AAAAAAAAAAAf+AAAAAP8AAAAAAH//8AAAAAAAAAAA/8AAAAAP4AAAAAAH//8AAAAAAAAAAA/8AAAAAHgAAAAAAH4/8AAAAAAAAAAA/4AAAAAAAAAAAAAAAP4AAAAAAAAAAA/wAAAAAAAAAAAAAAADwAGAAAAAAAAA/AAAAAAAAAAAAAAAAAAAGAAAAAAAAB8AAAAAAAAAAAAAAAAAAAGAAAAAAAAB4AAAAAAAAAAAAAAAAAwAQAAAAAAAAB4AAAAAAAAAAAAAAAAAAAwAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf4AAAAAAAAAAAAAAAAAAAAAAAAAAAH/8AAAAAAAAA///////gAAAAAAAAAD//+AAAAAD///////////gAAAAAAAA////AAD///////////////g///////////g//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const DEG_TO_RAD = Math.PI / 180;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type SpherePoint = readonly [x: number, y: number, z: number];

let cachedMask: Uint8Array | null = null;
let cachedLandDots: SpherePoint[] | null = null;

function decodeLandMask(): Uint8Array {
  if (cachedMask) return cachedMask;
  const binary = atob(LAND_MASK_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  cachedMask = bytes;
  return bytes;
}

function isLand(latDeg: number, lngDeg: number, mask: Uint8Array): boolean {
  const row = Math.min(MASK_HEIGHT - 1, Math.max(0, Math.floor(((90 - latDeg) / 180) * MASK_HEIGHT)));
  const normLng = (((lngDeg + 180) % 360) + 360) % 360;
  const col = Math.min(MASK_WIDTH - 1, Math.max(0, Math.floor((normLng / 360) * MASK_WIDTH)));
  const bitIndex = row * MASK_WIDTH + col;
  return (mask[bitIndex >> 3] & (1 << (7 - (bitIndex & 7)))) !== 0;
}

/** 地理经纬度（度）-> 右手单位球面坐标 (+Y 北极, +Z 本初子午线朝向观察者, +X 东经90°) */
export function latLngToSphere(latDeg: number, lngDeg: number): SpherePoint {
  const lat = latDeg * DEG_TO_RAD;
  const lng = lngDeg * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.sin(lng), Math.sin(lat), cosLat * Math.cos(lng)];
}

/**
 * 生成均匀分布于全球陆地的斐波那契球面点阵（各纬度间距一致，无极区堆积）。
 * 总采样 3200 点 -> 约 900 个陆地点，Canvas 2D 每帧仅绘制前半球 ~450 点，稳定 60fps。
 */
export function getWorldLandDots(samples = 3200): readonly SpherePoint[] {
  if (cachedLandDots) return cachedLandDots;
  const mask = decodeLandMask();
  const points: SpherePoint[] = [];
  for (let i = 0; i < samples; i += 1) {
    const y = 1 - ((i + 0.5) / samples) * 2; // +1 .. -1
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const latDeg = Math.asin(y) / DEG_TO_RAD;
    const lngDeg = Math.atan2(x, z) / DEG_TO_RAD;
    if (isLand(latDeg, lngDeg, mask)) {
      points.push([x, y, z]);
    }
  }
  cachedLandDots = points;
  return points;
}
