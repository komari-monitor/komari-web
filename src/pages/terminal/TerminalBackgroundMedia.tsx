import { useEffect, useState } from "react";
import { isLikelyVideoUrl } from "./terminalDefaults";

export interface TerminalBackgroundMediaProps {
  url: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  opacity: number;
  blur: number;
}

const TerminalBackgroundMedia = ({
  url,
  offsetX,
  offsetY,
  scale,
  opacity,
  blur,
}: TerminalBackgroundMediaProps) => {
  const [mode, setMode] = useState<"image" | "video">(() =>
    isLikelyVideoUrl(url) ? "video" : "image",
  );

  useEffect(() => {
    setMode(isLikelyVideoUrl(url) ? "video" : "image");
  }, [url]);

  // CSS filter: blur(r) 在元素边缘外部采样透明像素，扩展 >= 3r 外边距并由外层 overflow-hidden 裁剪，
  // 避免大模糊半径下四边出现黑边。
  const bleed = blur > 0 ? Math.ceil(blur * 3) + 2 : 0;
  const mediaStyle = {
    transform: `translate3d(${offsetX}%, ${offsetY}%, 0) scale(${scale / 100})`,
    transformOrigin: "center center",
  };

  return (
    <div
      className="km-terminal-background pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      style={{ opacity: Math.max(0, Math.min(1, opacity / 100)) }}
      aria-hidden="true"
    >
      <div
        className="absolute"
        style={{
          inset: bleed > 0 ? `-${bleed}px` : 0,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        }}
      >
        <div className="h-full w-full overflow-hidden">
          {mode === "video" ? (
            <video
              key={url}
              src={url}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
              style={mediaStyle}
            />
          ) : (
            <img
              key={url}
              src={url}
              alt=""
              draggable={false}
              onError={() => setMode("video")}
              className="h-full w-full object-cover"
              style={mediaStyle}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TerminalBackgroundMedia;
