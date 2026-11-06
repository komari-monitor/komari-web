import { usePWA } from '../hooks/usePWA';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { WifiOff, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { MOTION_SPRING } from '@/lib/motion';

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

export const OnlineIndicator = () => {
  const { isOnline: isOnlineOnline } = usePWA();
  const { t: tOnline } = useTranslation();
  return (
    <div className="km-offline-indicator flex items-center gap-1 text-xs text-gray-500">
      <AnimatePresence mode="popLayout" initial={false}>
        {isOnlineOnline ? (
          <motion.span
            key="online"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={MOTION_SPRING.snappy}
            className="flex items-center gap-1"
          >
            <Wifi size={12} className="text-green-500" />
            <span>{tOnline('nodeCard.online')}</span>
          </motion.span>
        ) : (
          <motion.span
            key="offline"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={MOTION_SPRING.snappy}
            className="flex items-center gap-1"
          >
            <WifiOff size={12} className="text-orange-500" />
            <span>{tOnline('nodeCard.offline')}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};
