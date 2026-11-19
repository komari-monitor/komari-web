import { lazy, Suspense, useState } from "react";
import type { NodeDetail } from "@/contexts/NodeDetailsContext";
import Flag from "@/components/Flag";

const loadDetailDrawer = () => import("./DetailDrawer");
const DetailDrawer = lazy(loadDetailDrawer);

export default function DetailView({ node }: { node: NodeDetail }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  return (
    <>
      <div
        className="h-8 flex items-center hover:underline cursor-pointer font-bold text-base"
        onPointerEnter={() => void loadDetailDrawer()}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <Flag flag={node.region} size="6" />
        {node.name.length > 25 ? node.name.slice(0, 25) + "..." : node.name}
      </div>
      {mounted && (
        <Suspense fallback={null}>
          <DetailDrawer node={node} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
