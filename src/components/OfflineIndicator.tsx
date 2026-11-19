import { usePWA } from '../hooks/usePWA';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const OfflineIndicator = () => {
  const { isOnline: isOnlineOffline } = usePWA();
  const { t: tOffline } = useTranslation();
  // 只在离线时弹出 Toast
  useEffect(() => {
    if (!isOnlineOffline) {
      toast.error(
        <div className="flex items-center gap-2 text-sm">
          <WifiOff size={16} />
          <span>{tOffline('pwa.offline_hint')}</span>
        </div>
      );
    }
  }, [isOnlineOffline, tOffline]);
  return null;
};
