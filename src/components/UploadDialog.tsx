import React, { useRef } from "react";
import { Dialog, Box, Flex, Button, Text, Card } from "@radix-ui/themes";
import { AnimatePresence, motion } from "motion/react";
import { Upload as UploadIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/motion";
import { GapCollapse } from "@/components/GapCollapse";
import { MOTION_SPRING } from "@/lib/motion";
import { SPACE } from "@/lib/spacing";

export type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  accept?: string; // e.g. ".zip,.png" or MIME types
  dragDropText?: React.ReactNode;
  clickToBrowseText?: React.ReactNode;
  hintText?: React.ReactNode;
  uploading?: boolean;
  progress?: number; // 0-100
  uploadingText?: React.ReactNode;
  cancelUploadLabel?: React.ReactNode;
  onCancelUpload?: () => void;
  onFileSelected?: (file: File) => void;
  closeLabel?: React.ReactNode;
};

// Utility to match file by accept list (extensions or mime types)
function matchesAccept(file: File, accept: string | undefined) {
  if (!accept || accept.trim() === "" || accept === "*/*") return true;
  const items = accept.split(",").map((s) => s.trim().toLowerCase());
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  for (const it of items) {
    if (it.startsWith(".")) {
      if (name.endsWith(it)) return true;
    } else if (it.includes("/")) {
      if (type === it) return true;
      // wildcard like image/*
      const [m] = it.split("/");
      const [fm] = type.split("/");
      if (m && m === fm) return true;
    }
  }
  return false;
}

const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  accept = "*/*",
  dragDropText,
  clickToBrowseText,
  hintText,
  uploading = false,
  progress = 0,
  uploadingText,
  cancelUploadLabel,
  onCancelUpload,
  onFileSelected,
  closeLabel = "Close",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading) return;
    const files = Array.from(e.dataTransfer.files);
    const file = files.find((f) => matchesAccept(f, accept));
    if (file && onFileSelected) onFileSelected(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    const file = e.target.files?.[0];
    if (file && matchesAccept(file, accept) && onFileSelected)
      onFileSelected(file);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="450px" className="km-upload-dialog">
        <Dialog.Title>{title}</Dialog.Title>
        {description ? (
          <Dialog.Description>{description}</Dialog.Description>
        ) : null}

        {/* 内容栈：拖放区与进度卡同属一块内容（block）；底部按钮与内容之间 section */}
        <Flex direction="column" gap="4" mt="4" className="km-upload-file-list">
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="2"
            className="km-upload-dropzone border-2 border-dashed border-gray-300 rounded-lg p-km-page text-center cursor-pointer hover:border-gray-400 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => {
              if (!uploading) inputRef.current?.click();
            }}
          >
            <UploadIcon size={48} className="text-gray-400 mb-km-group" />
            {dragDropText ? (
              <Text size="3" weight="medium">{dragDropText}</Text>
            ) : null}
            {clickToBrowseText ? (
              <Text size="2" color="gray">
                {clickToBrowseText}
              </Text>
            ) : null}
            {hintText ? (
              <Text size="1" color="gray">
                {hintText}
              </Text>
            ) : null}
          </Flex>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />

        <AnimatePresence initial={false}>
        {uploading && (
          // 进度卡在拖放区下方展开（高度弹簧），连同栈的 block 间距一起补间，关闭按钮顺势下移，不被突然顶开
          <GapCollapse key="upload-progress-card" gap={SPACE.block}>
            <Flex justify="center">
            <Card size="2" className="text-center min-w-80 max-w-md">
              <Flex direction="column" align="center" gap="2">
              {uploadingText ? (
                <Text size="3">
                  {uploadingText}
                </Text>
              ) : null}

              {/* Progress bar */}
              <Box className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                {/* feedback 层：进度用弹簧缩放追赶，百分比文字同步滚动 */}
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full origin-left rounded-full relative"
                  style={{ width: "100%" }}
                  initial={false}
                  animate={{ scaleX: Math.max(0, Math.min(100, progress)) / 100 }}
                  transition={{ scaleX: { ...MOTION_SPRING.soft, restDelta: 0.0005 } }}
                >
                  <Box className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </motion.div>
              </Box>

              <Flex justify="between" align="center">
                <Text size="2" color="gray">
                  <AnimatedNumber
                    value={Math.round(Math.max(0, Math.min(100, progress)))}
                    // 弹簧的中间值是小数，取整后再显示，避免出现 37.2345%
                    format={(value) => String(Math.round(value))}
                  />
                  %
                </Text>
              </Flex>

              {onCancelUpload ? (
                <Button
                  variant="soft"
                  color="gray"
                  onClick={onCancelUpload}
                >
                  {cancelUploadLabel ?? "Cancel"}
                </Button>
              ) : null}
              </Flex>
            </Card>
            </Flex>
          </GapCollapse>
        )}
        </AnimatePresence>
        </Flex>

        <Flex gap="2" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {closeLabel}
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default UploadDialog;