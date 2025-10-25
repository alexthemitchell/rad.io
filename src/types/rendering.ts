/**
 * Rendering backend tier enumeration in priority order.
 * Higher tiers indicate more capable rendering backends.
 */
export enum RenderTier {
  WebGPU = "WebGPU",
  WebGL2 = "WebGL2",
  WebGL1 = "WebGL1",
  Worker = "Worker",
  Canvas2D = "Canvas2D",
  Unknown = "Unknown",
}

/**
 * Priority order map for comparing tiers.
 * Larger values represent higher-priority backends.
 */
export const RenderTierPriority: Record<RenderTier, number> = {
  [RenderTier.WebGPU]: 5,
  [RenderTier.WebGL2]: 4,
  [RenderTier.WebGL1]: 3,
  [RenderTier.Worker]: 2,
  [RenderTier.Canvas2D]: 1,
  [RenderTier.Unknown]: 0,
};

/**
 * Utility to compute the higher of two tiers by priority.
 */
export function maxTier(a: RenderTier, b: RenderTier): RenderTier {
  return RenderTierPriority[a] >= RenderTierPriority[b] ? a : b;
}
