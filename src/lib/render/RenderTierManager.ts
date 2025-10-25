import { RenderTier, maxTier } from "../../types/rendering";

type TierListener = (tier: RenderTier) => void;

/**
 * Singleton manager to track the highest successful rendering backend tier
 * used anywhere in the app (WebGPU → WebGL2 → WebGL1 → Worker → Canvas2D).
 */
export class RenderTierManager {
  private static instance: RenderTierManager | null = null;
  private currentTier: RenderTier = RenderTier.Unknown;
  private listeners = new Set<TierListener>();

  static getInstance(): RenderTierManager {
    RenderTierManager.instance ??= new RenderTierManager();
    return RenderTierManager.instance;
  }

  /** Current highest known render tier */
  getTier(): RenderTier {
    return this.currentTier;
  }

  /** Report a successful render using a given tier. Upgrades global tier if higher. */
  reportSuccess(tier: RenderTier): void {
    const next = maxTier(this.currentTier, tier);
    if (next !== this.currentTier) {
      this.currentTier = next;
      this.emit(next);
    }
  }

  /** Forcefully set the tier (used in tests) */
  setTier(tier: RenderTier): void {
    if (tier !== this.currentTier) {
      this.currentTier = tier;
      this.emit(tier);
    }
  }

  /** Reset to Unknown */
  reset(): void {
    this.setTier(RenderTier.Unknown);
  }

  /** Subscribe to tier changes. Returns an unsubscribe function. */
  subscribe(listener: TierListener): () => void {
    this.listeners.add(listener);
    // Immediately notify current state
    try {
      listener(this.currentTier);
    } catch {
      // ignore listener errors
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(tier: RenderTier): void {
    for (const listener of this.listeners) {
      try {
        listener(tier);
      } catch {
        // ignore listener errors
      }
    }
  }
}

// Convenience singleton export
export const renderTierManager = RenderTierManager.getInstance();
