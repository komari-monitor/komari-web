import * as React from "react";

interface FlagProps {
  flag: string;
}

const getTwemojiUrl = (emoji: string): string => {
  const codePoints = Array.from(emoji)
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("-");
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoints}.svg`;
};

const Flag = React.memo(({ flag }: FlagProps) => {
  const emoji = flag && /\p{Emoji}/u.test(flag) ? flag : "🌐";
  const twemojiUrl = getTwemojiUrl(emoji);

  return (
    <span
      className="w-6 h-6 m-2 self-center inline-flex items-center"
      aria-label={`Region: ${emoji}`}
    >
      <img
        src={twemojiUrl}
        alt={`Region flag: ${emoji}`}
        className="w-full h-full object-contain"
      />
    </span>
  );
});

Flag.displayName = "Flag";

export default Flag;