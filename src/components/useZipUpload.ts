import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  createChunkUploadTask,
  type ChunkUploadTask,
  type UploadPurpose,
} from "@/lib/chunkUpload";

interface ZipUploadOptions {
  purpose: UploadPurpose;
  /** 非 .zip 文件的提示 */
  invalidTypeText: string;
  successText: string;
  /** 失败提示前缀，后面拼接 ": <错误信息>" */
  failedText: string;
  /** 上传成功（对话框已关闭）后刷新列表 */
  onUploaded: () => Promise<unknown>;
}

/**
 * 主题 / 插件 zip 包的分片上传：进度、取消、成功后关闭对话框并刷新列表。
 * 返回值直接喂给 UploadDialog。
 */
export function useZipUpload({
  purpose,
  invalidTypeText,
  successText,
  failedText,
  onUploaded,
}: ZipUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadTaskRef = useRef<ChunkUploadTask | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const upload = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      toast.error(invalidTypeText);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    const task = createChunkUploadTask("/api/admin/upload");
    uploadTaskRef.current = task;
    try {
      await task.upload(purpose, file, setUploadProgress);
      toast.success(successText);
      setUploadDialogOpen(false);
      setUploadProgress(0);
      await onUploaded();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(
          failedText +
            ": " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    } finally {
      setUploading(false);
      uploadTaskRef.current = null;
    }
  };

  const cancelUpload = () => {
    uploadTaskRef.current?.cancel();
    setUploadProgress(0);
  };

  return {
    uploading,
    uploadProgress,
    uploadDialogOpen,
    setUploadDialogOpen,
    upload,
    cancelUpload,
  };
}
