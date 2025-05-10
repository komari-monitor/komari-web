import { Card, Flex, Text, Badge, Separator } from '@radix-ui/themes';
import type { Record } from "../types/LiveData";
import type { NodeBasicInfo } from "../types/NodeBasicInfo";
import UsageBar from './UsageBar';
import Flag from './Flag';

/*
function formatOs(os: string): string {
  const patterns = [
    { regex: /debian/i, name: "Debian" },
    { regex: /ubuntu/i, name: "Ubuntu" },
    { regex: /windows/i, name: "Windows" },
    { regex: /arch/i, name: "Arch" },
    { regex: /alpine/i, name: "Alpine" },
    { regex: /centos/i, name: "CentOS" },
    { regex: /fedora/i, name: "Fedora" },
    { regex: /red\s*hat/i, name: "RHEL" },
    { regex: /opensuse/i, name: "openSUSE" },
    { regex: /manjaro/i, name: "Manjaro" },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(os)) {
      return pattern.name;
    }
  }

  return os.split(/[\s/]/)[0];
}
*/
/** 将字节转换为人类可读的大小 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

interface NodeProps {
  basic: NodeBasicInfo;
  live: Record | undefined;
  online: boolean;
}
const Node = ({ basic, live, online }: NodeProps) => {
  const defaultLive = {
    cpu: { usage: 0 },
    ram: { used: 0 },
    disk: { used: 0 },
    network: { up: 0, down: 0, totalUp: 0, totalDown: 0 },
  } as Record;

  const liveData = live || defaultLive;

  const memoryUsagePercent = basic.mem_total
    ? (liveData.ram.used / basic.mem_total) * 100
    : 0;
  const diskUsagePercent = basic.disk_total
    ? (liveData.disk.used / basic.disk_total) * 100
    : 0;

  const uploadSpeed = formatBytes(liveData.network.up);
  const downloadSpeed = formatBytes(liveData.network.down);
  const totalUpload = formatBytes(liveData.network.totalUp);
  const totalDownload = formatBytes(liveData.network.totalDown);
  //const totalTraffic = formatBytes(liveData.network.totalUp + liveData.network.totalDown);
  return (
    <Card
      style={{
        width: '100%',
        maxWidth: '400px',
        margin: '0 auto',
        transition: 'all 0.2s ease-in-out',

      }}
    >
      <Flex direction="column" gap="3">
        <Flex justify="between" align="center">
          <Flex justify="start" align="center">
            <Flag flag={basic.region}/>
            <Text weight="bold" size="4" truncate style={{ maxWidth: '200px' }}>
            {basic.name}
          </Text>
          </Flex>
          
          <Badge color={online ? 'green' : 'red'} variant="soft">
            {online ? 'Online' : 'Offline'}
          </Badge>
        </Flex>

        <Separator size="4" />

        <Flex direction="column" gap="2">
          <Flex justify="between">
            <Text size="2" color="gray">
              OS
            </Text>
            <Text size="2">{basic.os}</Text>
          </Flex>

          {/* CPU Usage */}
          <UsageBar label="CPU" value={liveData.cpu.usage} />

          {/* Memory Usage */}
          <UsageBar label="Memory" value={memoryUsagePercent} />
          <Text size="1" color="gray" style={{ marginTop: '-4px' }}>
            ({formatBytes(liveData.ram.used)} / {formatBytes(basic.mem_total)})
          </Text>

          {/* Disk Usage */}
          <UsageBar label="Disk" value={diskUsagePercent} />
          <Text size="1" color="gray" style={{ marginTop: '-4px' }}>
            ({formatBytes(liveData.disk.used)} / {formatBytes(basic.disk_total)})
          </Text>

          <Flex justify="between">
            <Text size="2" color="gray">
              Network Speed
            </Text>
            <Text size="2">
              ↑ {uploadSpeed}/s ↓ {downloadSpeed}/s
            </Text>
          </Flex>

          <Flex justify="between">
            <Text size="2" color="gray">
              Total Traffic 
            </Text>
            <Text size="2">↑ {totalUpload}/s ↓ {totalDownload}/s</Text>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
};


export default Node;