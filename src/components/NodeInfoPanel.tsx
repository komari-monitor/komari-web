import type { NodeBasicInfo, Record } from "@/types/NodeInfo";
import { formatBytes } from "@/types/NodeInfo";

type InfoBlockProps = {
  name: string;
  value: string;
};

type NodeInfoPanelProps = {
  nodeBasicInfo: NodeBasicInfo | undefined;
  record: Record | null;
};

export const InfoBlock = ({ name, value }: InfoBlockProps) => (
  <div className="text-left text-gray-600 px-1.5 py-1">
    <div className="text-xs">{name}</div>
    <div className="text-xs font-semibold text-gray-900">{value}</div>
  </div>
);

export const NodeInfoPanel = ({
  nodeBasicInfo,
  record,
}: NodeInfoPanelProps) => {
  const formatUptime = (uptimeInSeconds: number): string => {
    if (uptimeInSeconds === undefined || uptimeInSeconds === null) return "N/A";
    const days = Math.floor(uptimeInSeconds / (24 * 60 * 60));
    const hours = Math.floor((uptimeInSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptimeInSeconds % (60 * 60)) / 60);
    let uptimeString = "";
    if (days > 0) uptimeString += `${days}天 `;
    if (hours > 0 || days > 0) uptimeString += `${hours}小时 `;
    uptimeString += `${minutes}分钟`;
    return uptimeString.trim() || "0分钟";
  };

  if (!nodeBasicInfo) return null;

  const memoryDisplay = formatBytes(nodeBasicInfo.mem_total);
  const diskDisplay = formatBytes(nodeBasicInfo.disk_total);
  const cpuDisplay = nodeBasicInfo.cpu_name;

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex flex-wrap gap-[6px]">
        <InfoBlock name="操作系统" value={nodeBasicInfo.os} />
        <InfoBlock name="架构" value={nodeBasicInfo.arch} />
        <InfoBlock name="虚拟化" value={nodeBasicInfo.virtualization} />
      </div>
      <div className="flex flex-wrap gap-[6px]">
        <InfoBlock name="CPU" value={cpuDisplay} />
        <InfoBlock name="GPU" value={nodeBasicInfo.gpu_name || "N/A"} />
      </div>
      <div className="flex flex-wrap gap-[6px]">
        <InfoBlock name="内存" value={memoryDisplay} />
        <InfoBlock name="磁盘" value={diskDisplay} />
        {/* record 存在时才显示总流量 */}
        {record && record.network ? (
          <InfoBlock
            name="总流量"
            value={formatBytes(
              record.network.totalUp + record.network.totalDown
            )}
          />
        ) : null}
      </div>
      {/* record 存在时才显示运行时间和最后上报 */}
      {record ? (
        <div className="flex flex-wrap gap-[6px]">
          <InfoBlock name="运行时间" value={formatUptime(record.uptime)} />
          <InfoBlock
            name="最后上报"
            value={
              record.updated_at
                ? new Date(record.updated_at).toLocaleString()
                : "N/A"
            }
          />
        </div>
      ) : null}
    </div>
  );
};
