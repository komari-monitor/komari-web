import * as React from "react";
import { Box } from "@radix-ui/themes";
interface FlagProps {
  flag: string; // Emoji or region code (e.g., 🇺🇳 or "UN")
}
// Utility to convert emoji to Twemoji URL
const getTwemojiUrl = (emoji: string): string => {
  // Convert emoji to Unicode code points (e.g., 🇺🇳 -> 1f1fa-1f1f3)
  const codePoints = Array.from(emoji)
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("-");
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoints}.svg`;
};

const Flag = React.memo(({ flag }: FlagProps) => {
  // Fallback to a default emoji if flag is invalid
  const emoji = flag && /\p{Emoji}/u.test(flag) ? flag : "🌐";
  const twemojiUrl = getTwemojiUrl(emoji);

  return (
    <Box
      as="span"
      className="w-6 h-6 m-2 self-center"
      style={{ display: "inline-flex", alignItems: "center" }}
      aria-label={`Region: ${emoji}`}
    >
      <img
        src={twemojiUrl}
        alt={`Region flag: ${emoji}`}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </Box>
  );
});

// Ensure displayName for debugging
Flag.displayName = "Flag";

export default Flag;
