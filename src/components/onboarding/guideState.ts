export const GUIDE_IDS = ["install", "workbench", "notifications", "markets", "terminal"] as const;
export type GuideId = (typeof GUIDE_IDS)[number];
export const GUIDE_SETTINGS_KEY = "_komari_onboarding_v1";

export interface GuideState {
  seen: GuideId[];
  workbenchOpened: boolean;
}

export function parseGuideState(value: unknown): GuideState {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    seen: GUIDE_IDS.filter((id) => Array.isArray(record.seen) && record.seen.includes(id)),
    workbenchOpened: record.workbenchOpened === true,
  };
}

export function selectAdminGuide(nodeCount: number, state: GuideState): GuideId | null {
  const candidates: GuideId[] = [
    ...(nodeCount === 0 ? ["install" as const] : []),
    ...(nodeCount > 0 && !state.workbenchOpened ? ["workbench" as const] : []),
    "notifications",
    "markets",
  ];
  return candidates.find((guide) => !state.seen.includes(guide)) ?? null;
}
