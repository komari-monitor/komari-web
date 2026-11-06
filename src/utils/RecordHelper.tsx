import type { Record } from "@/types/LiveData";

type GpuDetail = {
  usage: number | null;
  memory: number | null;
  temperature: number | null;
  device_index?: number;
  device_name?: string;
  mem_total?: number;
  mem_used?: number;
};

export interface RecordFormat {
  client: string;
  time: string;
  cpu: number | null;
  gpu: number | null;
  gpu_usage: number | null;
  gpu_memory: number | null;
  gpu_detailed?: {
    [index: number]: GpuDetail;
  };
  ram: number | null;
  ram_total: number | null;
  swap: number | null;
  swap_total: number | null;
  load: number | null;
  temp: number | null;
  disk: number | null;
  disk_total: number | null;
  net_in: number | null;
  net_out: number | null;
  net_total_up: number | null;
  net_total_down: number | null;
  process: number | null;
  connections: number | null;
  connections_udp: number | null;
}

export function liveDataToRecords(
  client: string,
  liveData: Record[]
): RecordFormat[] {
  if (!liveData) return [];
  return liveData.map((data) => ({
    client: client,
    time: data.updated_at || "",
    cpu: data.cpu.usage ?? 0,
    gpu: 0,
    gpu_usage: data.gpu?.average_usage ?? 0,
    gpu_memory: data.gpu ?
      data.gpu.detailed_info?.reduce((acc, gpu) =>
        acc + (gpu.memory_used / gpu.memory_total) * 100, 0) / data.gpu.count || 0
      : 0,
    gpu_detailed: data.gpu?.detailed_info?.reduce((acc, gpu, index) => {
      acc[index] = {
        usage: gpu.utilization ?? null,
        memory: (gpu.memory_used / gpu.memory_total) * 100,
        temperature: gpu.temperature ?? null,
        device_index: index,
        device_name: gpu.name,
        mem_total: gpu.memory_total,
        mem_used: gpu.memory_used,
      };
      return acc;
    }, {} as { [index: number]: GpuDetail }) || undefined,
    ram: data.ram.used ?? 0,
    ram_total: 0,
    swap: data.swap.used ?? 0,
    swap_total: 0,
    load: data.load.load1 ?? 0,
    temp: 0,
    disk: data.disk.used ?? 0,
    disk_total: 0,
    net_in: data.network?.down ?? 0,
    net_out: data.network?.up ?? 0,
    net_total_up: data.network?.totalUp ?? 0,
    net_total_down: data.network?.totalDown ?? 0,
    process: data.process ?? 0,
    connections: data.connections.tcp ?? 0,
    connections_udp: data.connections.udp ?? 0,
  }));
}
