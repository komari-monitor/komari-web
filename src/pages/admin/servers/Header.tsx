import React, { useState } from "react";
import { useNodeDetails } from "@/contexts/NodeDetailsContext";
import { Flex, TextField, Button, Text, Dialog } from "@radix-ui/themes";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { FEEDBACK_MOTION, MOTION_SPRING, MOTION_TRANSITION } from "@/lib/motion";
import { AnimatedNumber } from "@/components/motion";
import PageHeader from "@/components/PageHeader";
import { addClient } from "./api";
import AutoDiscoverySection from "./AutoDiscoverySection";

const Header = ({
  searchTerm,
  setSearchTerm,
  selectedNodes,
  settings,
  settingsLoading,
}: {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedNodes: string[];
  settings: any;
  settingsLoading: boolean;
}) => {
  const { t } = useTranslation();
  const { refresh } = useNodeDetails();
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const handleAddNode = async (name: string | undefined) => {
    setDialogOpen(true);
    setLoading(true);
    try {
      await addClient(name || "");
      refresh();
    } catch (error) {
      toast.error(
        `${t("common.error", "Error")}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setLoading(false);
      setDialogOpen(false);
    }
  };
  return (
    <PageHeader
      title={
        <>
          {t("admin.nodeTable.nodeList")}
          {/* feedback 层：勾选数量出现/消失轻弹，变化时数字滚动，不整块重画 */}
          <AnimatePresence initial={false}>
            {selectedNodes.length > 0 && (
              <motion.span
                key="selected-count"
                className="ml-km-group inline-flex"
                initial={FEEDBACK_MOTION.pop.initial}
                animate={FEEDBACK_MOTION.pop.animate}
                exit={FEEDBACK_MOTION.pop.exit}
                transition={{ scale: MOTION_SPRING.pop, opacity: MOTION_TRANSITION.fade }}
              >
                <Text size="2" weight="regular">
                  (<AnimatedNumber value={selectedNodes.length} /> selected)
                </Text>
              </motion.span>
            )}
          </AnimatePresence>
        </>
      }
      actions={
        <>
          <TextField.Root
            placeholder={t("admin.nodeTable.searchByName")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Trigger>
              <Button data-guide="add-node" onClick={() => setDialogOpen(true)}>
                <Plus size={16} />
                {t("admin.nodeTable.addNode")}
              </Button>
            </Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Title>{t("admin.nodeTable.addNode")}</Dialog.Title>
              <TextField.Root
                ref={inputRef}
                placeholder={t("admin.nodeTable.nameOptional")}
              />
              <Flex justify="end" gap="2" mt="4">
                <Button
                  onClick={() => handleAddNode(inputRef.current?.value)}
                  disabled={loading}
                >
                  {t("admin.nodeTable.addNode")}
                </Button>
              </Flex>
              <AutoDiscoverySection
                settings={settings}
                loading={settingsLoading}
              />
            </Dialog.Content>
          </Dialog.Root>
        </>
      }
    />
  );
};

export default Header;
