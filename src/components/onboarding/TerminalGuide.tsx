import { useEffect, useRef, useState } from "react";
import GuidedTour, { type GuideStep } from "./GuidedTour";
import { hasBlockingLayer } from "./guideDom";
import { useGuideState } from "./useGuideState";

const steps: GuideStep[] = [
  {
    target: '[data-guide="terminal-tab"]',
    title: "onboarding.terminal.title",
    description: "onboarding.terminal.description",
  },
  {
    target: '[data-guide="terminal-tab"]',
    title: "onboarding.terminal.tools_title",
    description: "onboarding.terminal.tools_description",
  },
];

export default function TerminalGuide({
  authenticated,
  hasTabs,
  blocked,
}: {
  authenticated: boolean;
  hasTabs: boolean;
  blocked: boolean;
}) {
  const { state, mark } = useGuideState(authenticated);
  const attempted = useRef(false);
  const visited = useRef(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!state || visited.current) return;
    visited.current = true;
    if (!state.workbenchOpened) mark("workbenchOpened");
  }, [state, mark]);

  useEffect(() => {
    if (!state || !hasTabs || blocked || attempted.current) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || hasBlockingLayer()) return;
      attempted.current = true;
      setOpen(!state.seen.includes("terminal"));
      window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [state, hasTabs, blocked]);

  if (!open || !hasTabs || blocked) return null;
  return (
    <GuidedTour
      steps={steps}
      step={step}
      onStepChange={setStep}
      onDismiss={() => setOpen(false)}
      onShown={() => mark("terminal")}
    />
  );
}
