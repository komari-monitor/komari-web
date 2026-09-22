import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccount } from "@/contexts/AccountContext";
import type { GuideStep } from "./GuidedTour";
import { hasBlockingLayer } from "./guideDom";
import { selectAdminGuide, type GuideId } from "./guideState";
import { useGuideState } from "./useGuideState";

const nav = (path: string) => `[data-guide-nav="${path}"]`;
const steps: Partial<Record<GuideId, GuideStep[]>> = {
  install: [
    { target: nav("/admin/servers"), title: "onboarding.install.title", description: "onboarding.install.description" },
    { target: '[data-guide="add-node"]', title: "onboarding.install.add_title", description: "onboarding.install.add_description" },
  ],
  workbench: [
    { target: nav("/terminal"), title: "onboarding.workbench.title", description: "onboarding.workbench.description" },
    { target: nav("/terminal"), title: "onboarding.workbench.files_title", description: "onboarding.workbench.files_description" },
  ],
  notifications: [
    { target: nav("/admin/notification/channels"), title: "onboarding.notifications.title", description: "onboarding.notifications.description" },
    { target: nav("/admin/notification/offline"), title: "onboarding.notifications.offline_title", description: "onboarding.notifications.offline_description" },
    { target: nav("/admin/notification/general"), title: "onboarding.notifications.rules_title", description: "onboarding.notifications.rules_description" },
  ],
  markets: [
    { target: nav("/admin/market/themes"), title: "onboarding.markets.title", description: "onboarding.markets.description" },
    { target: nav("/admin/market/plugins"), title: "onboarding.markets.plugins_title", description: "onboarding.markets.plugins_description" },
  ],
};

export function useAdminGuide(ready: boolean) {
  const { account } = useAccount();
  const accountId = account?.uuid;
  const history = useGuideState(ready && Boolean(accountId));
  const navigate = useNavigate();
  const location = useLocation();
  const [nodeCount, setNodeCount] = useState<number | null>(null);
  const [guide, setGuide] = useState<GuideId | null>(null);
  const [step, setStep] = useState(0);
  const attempted = useRef(false);
  const expectedPath = useRef(location.pathname);

  useEffect(() => {
    if (!ready || !accountId) return;
    const controller = new AbortController();
    fetch("/api/admin/client/list", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data: unknown) => {
        if (!controller.signal.aborted && Array.isArray(data)) setNodeCount(data.length);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [ready, accountId]);

  useEffect(() => {
    if (!ready || !accountId || !history.state || nodeCount === null || attempted.current) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || hasBlockingLayer()) return;
      attempted.current = true;
      expectedPath.current = location.pathname;
      setGuide(selectAdminGuide(nodeCount, history.state!));
      window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [ready, accountId, history.state, nodeCount, location.pathname]);

  useEffect(() => {
    if (location.pathname !== expectedPath.current) setGuide(null);
  }, [location.pathname]);

  const changeStep = (next: number) => {
    if (guide === "install" && next === 1) {
      expectedPath.current = "/admin/servers";
      navigate("/admin/servers");
    }
    setStep(next);
  };

  const guideSteps = guide ? steps[guide] ?? [] : [];
  const menu = guide === "notifications" ? "/admin/notification/channels"
    : guide === "markets" ? (step === 0 ? "/admin/themes" : "/admin/plugins") : null;

  return {
    guide,
    steps: guideSteps,
    step,
    menu,
    changeStep,
    dismiss: () => setGuide(null),
    onShown: () => { if (guide) history.mark(guide); },
    act: () => {
      if (guide === "install") document.querySelector<HTMLButtonElement>('[data-guide="add-node"]')?.click();
      if (guide === "workbench") window.open("/terminal", "_blank", "noopener,noreferrer");
      if (guide === "notifications") navigate("/admin/notification/channels");
      if (guide === "markets") navigate("/admin/market/plugins");
    },
  };
}
