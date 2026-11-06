import { z } from "zod";
import { skeletonText } from "@/components/ui/skeleton";

const pprofProfileNameSchema = z.enum([
  "cpu",
  "trace",
  "allocs",
  "block",
  "goroutine",
  "heap",
  "mutex",
  "threadcreate",
]);
const pprofEndpointSchema = z.string().refine(
  (value) => value.startsWith("/api/admin/pprof/"),
  "invalid pprof endpoint",
);
const pprofProfileSchema = z.object({
  name: pprofProfileNameSchema,
  endpoint: pprofEndpointSchema,
  samples: z.number().int().nonnegative().optional(),
  timed: z.boolean().optional(),
  preview: pprofEndpointSchema.optional(),
});
const pprofSummarySchema = z.object({
  profiles: z.array(pprofProfileSchema),
  runtime: z.object({
    goroutines: z.number().int().nonnegative(),
    memory: z.object({
      heap_alloc: z.number().finite().nonnegative(),
      heap_inuse: z.number().finite().nonnegative(),
      heap_objects: z.number().int().nonnegative(),
      sys: z.number().finite().nonnegative(),
    }),
  }),
  duration: z.object({
    default_seconds: z.number().int().min(1).max(30),
    min_seconds: z.number().int().min(1).max(30),
    max_seconds: z.number().int().min(1).max(30),
  }),
});
export const pprofSummaryResponseSchema = z.object({
  status: z.literal("success"),
  data: pprofSummarySchema,
});

export type PprofProfile = z.infer<typeof pprofProfileSchema>;
export type PprofSummary = z.infer<typeof pprofSummarySchema>;
export type PprofPreview = {
  profile: PprofProfile;
  text: string;
};

export function captureDurations(summary: PprofSummary): number[] {
  return Array.from(
    new Set([
      summary.duration.min_seconds,
      summary.duration.default_seconds,
      summary.duration.max_seconds,
    ]),
  ).sort((left, right) => left - right);
}

export function pprofDownloadURL(profile: PprofProfile, seconds: number): string {
  if (!profile.timed) return profile.endpoint;

  const url = new URL(profile.endpoint, window.location.origin);
  url.searchParams.set("seconds", String(seconds));
  return url.pathname + url.search;
}

export function pprofFilename(profile: PprofProfile): string {
  return profile.name === "trace" ? "trace.out" : `${profile.name}.pprof`;
}

/**
 * 首次加载的占位概要：与真实接口同结构（8 个分析项、默认采集时长），
 * 用它渲染同样的三张卡片，外层 Skeletonize 画骨架；数据到达后同一批 DOM 淡入（行 key = 分析项名，不重挂）。
 */
export const PLACEHOLDER_SUMMARY: PprofSummary = {
  profiles: pprofProfileNameSchema.options.map((name) => ({
    name,
    endpoint: `/api/admin/pprof/${name}`,
    samples: 0,
    timed: name === "cpu" || name === "trace",
    preview: name === "heap" || name === "goroutine" ? `/api/admin/pprof/${name}` : undefined,
  })),
  runtime: { goroutines: 0, memory: { heap_alloc: 0, heap_inuse: 0, heap_objects: 0, sys: 0 } },
  duration: { default_seconds: 10, min_seconds: 5, max_seconds: 30 },
};

/** 堆预览骨架：几行长短不一的文字（与 pre 同字号） */
export const HEAP_PREVIEW_PLACEHOLDER = [48, 62, 36, 54, 30, 58, 40]
  .map((chars) => skeletonText(chars))
  .join("\n");
