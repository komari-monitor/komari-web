import { Container } from "@radix-ui/themes";
import GuideHeader from "@/components/GuideHeader";

/** 数据库迁移 / 恢复页顶部的品牌栏 */
export default function GuidePageHeader({ className }: { className: string }) {
  return (
    <header
      className={`${className} border-b bg-[var(--color-panel-solid)]`}
      style={{ borderColor: "var(--gray-a5)" }}
    >
      <Container size="3" px={{ initial: "4", sm: "6" }} py="3">
        <GuideHeader />
      </Container>
    </header>
  );
}
