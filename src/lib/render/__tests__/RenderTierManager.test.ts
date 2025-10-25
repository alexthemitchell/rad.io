import { RenderTierManager, renderTierManager } from "../RenderTierManager";
import { RenderTier } from "../../../types/rendering";

describe("RenderTierManager", () => {
  let manager: RenderTierManager;

  beforeEach(() => {
    manager = RenderTierManager.getInstance();
    manager.reset();
  });

  afterEach(() => {
    manager.reset();
  });

  it("should start with Unknown tier", () => {
    expect(manager.getTier()).toBe(RenderTier.Unknown);
  });

  it("should upgrade tier when reporting higher tier", () => {
    manager.reportSuccess(RenderTier.Canvas2D);
    expect(manager.getTier()).toBe(RenderTier.Canvas2D);

    manager.reportSuccess(RenderTier.WebGL1);
    expect(manager.getTier()).toBe(RenderTier.WebGL1);

    manager.reportSuccess(RenderTier.WebGPU);
    expect(manager.getTier()).toBe(RenderTier.WebGPU);
  });

  it("should not downgrade tier when reporting lower tier", () => {
    manager.reportSuccess(RenderTier.WebGPU);
    expect(manager.getTier()).toBe(RenderTier.WebGPU);

    manager.reportSuccess(RenderTier.Canvas2D);
    expect(manager.getTier()).toBe(RenderTier.WebGPU);
  });

  it("should notify subscribers on tier changes", () => {
    const listener = jest.fn();
    const unsubscribe = manager.subscribe(listener);

    // Should get initial notification
    expect(listener).toHaveBeenCalledWith(RenderTier.Unknown);

    manager.reportSuccess(RenderTier.WebGL2);
    expect(listener).toHaveBeenCalledWith(RenderTier.WebGL2);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("should not notify after unsubscribe", () => {
    const listener = jest.fn();
    const unsubscribe = manager.subscribe(listener);

    listener.mockClear();
    unsubscribe();

    manager.reportSuccess(RenderTier.WebGPU);
    expect(listener).not.toHaveBeenCalled();
  });

  it("should handle multiple subscribers", () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();

    manager.subscribe(listener1);
    manager.subscribe(listener2);

    listener1.mockClear();
    listener2.mockClear();

    manager.reportSuccess(RenderTier.WebGL1);

    expect(listener1).toHaveBeenCalledWith(RenderTier.WebGL1);
    expect(listener2).toHaveBeenCalledWith(RenderTier.WebGL1);
  });

  it("should reset to Unknown", () => {
    manager.reportSuccess(RenderTier.WebGPU);
    expect(manager.getTier()).toBe(RenderTier.WebGPU);

    manager.reset();
    expect(manager.getTier()).toBe(RenderTier.Unknown);
  });

  it("should provide singleton instance", () => {
    const instance1 = RenderTierManager.getInstance();
    const instance2 = RenderTierManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should export singleton as renderTierManager", () => {
    expect(renderTierManager).toBe(RenderTierManager.getInstance());
  });

  it("should handle listener errors gracefully", () => {
    const errorListener = jest.fn(() => {
      throw new Error("Listener error");
    });
    const normalListener = jest.fn();

    manager.subscribe(errorListener);
    manager.subscribe(normalListener);

    errorListener.mockClear();
    normalListener.mockClear();

    // Should not throw
    expect(() => manager.reportSuccess(RenderTier.WebGL2)).not.toThrow();

    // Normal listener should still be called
    expect(normalListener).toHaveBeenCalledWith(RenderTier.WebGL2);
  });
});
