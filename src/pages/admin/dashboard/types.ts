export type TopRankItem = {
  uuid: string;
  name: string;
  value: number;
  peak: number;
  peakTime: number;
};

export type TrafficNodeTotals = {
  uuid: string;
  up: number;
  down: number;
  total: number;
  peakRate: number;
  peakTime: number;
};

export type PingRankItem = {
  key: string;
  entityId: string;
  taskId: string;
  label: string;
  p95: number | null;
  volatility: number;
  loss: number;
  valid: number;
};

export type TrafficSummary = {
  points: {
    time: number;
    upRate: number;
    downRate: number;
    upCum: number;
    downCum: number;
  }[];
  nodeTotals: TrafficNodeTotals[];
  totalUp: number;
  totalDown: number;
};

export type DbSizeInfo = {
  main: number | null;
  monitoring: number | null;
};

export type DashboardStats = {
  total: number;
  online: number;
  offline: number;
  onlineRate: number;
};

export type DashboardHealth = {
  level: "empty" | "healthy" | "warning" | "danger";
  color: "gray" | "green" | "orange" | "red";
};
