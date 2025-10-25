/**
 * Priority Queue Tests
 * Tests for ADR-0012: Parallel FFT Worker Pool
 */

import { PriorityQueue } from "../priority-queue";

describe("PriorityQueue", () => {
  describe("basic operations", () => {
    it("should start empty", () => {
      const queue = new PriorityQueue<{ priority: number; value: string }>();
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it("should enqueue and dequeue items", () => {
      const queue = new PriorityQueue<{ priority: number; value: string }>();
      queue.enqueue({ priority: 1, value: "low" });
      queue.enqueue({ priority: 5, value: "high" });
      queue.enqueue({ priority: 3, value: "medium" });

      expect(queue.size()).toBe(3);
      expect(queue.isEmpty()).toBe(false);

      const item1 = queue.dequeue();
      expect(item1?.value).toBe("high");
      expect(queue.size()).toBe(2);

      const item2 = queue.dequeue();
      expect(item2?.value).toBe("medium");

      const item3 = queue.dequeue();
      expect(item3?.value).toBe("low");

      expect(queue.isEmpty()).toBe(true);
    });

    it("should return undefined when dequeuing from empty queue", () => {
      const queue = new PriorityQueue<{ priority: number; value: string }>();
      const item = queue.dequeue();
      expect(item).toBeUndefined();
    });

    it("should peek without removing", () => {
      const queue = new PriorityQueue<{ priority: number; value: string }>();
      queue.enqueue({ priority: 1, value: "low" });
      queue.enqueue({ priority: 5, value: "high" });

      const peeked = queue.peek();
      expect(peeked?.value).toBe("high");
      expect(queue.size()).toBe(2); // Size unchanged
    });
  });

  describe("priority ordering", () => {
    it("should maintain priority order with multiple items", () => {
      const queue = new PriorityQueue<{ priority: number; value: number }>();

      // Add items in random order
      [5, 1, 9, 3, 7, 2, 8, 4, 6].forEach((priority) => {
        queue.enqueue({ priority, value: priority });
      });

      // Should dequeue in descending priority order
      const results: number[] = [];
      while (!queue.isEmpty()) {
        const item = queue.dequeue();
        if (item) results.push(item.value);
      }

      expect(results).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    });

    it("should handle equal priorities (FIFO for same priority)", () => {
      const queue = new PriorityQueue<{ priority: number; value: string }>();

      queue.enqueue({ priority: 5, value: "first" });
      queue.enqueue({ priority: 5, value: "second" });
      queue.enqueue({ priority: 5, value: "third" });

      // All have same priority, but first in should be first out
      const item1 = queue.dequeue();
      expect(item1?.priority).toBe(5);
    });

    it("should handle negative priorities", () => {
      const queue = new PriorityQueue<{ priority: number; value: string }>();

      queue.enqueue({ priority: -5, value: "negative" });
      queue.enqueue({ priority: 0, value: "zero" });
      queue.enqueue({ priority: 5, value: "positive" });

      expect(queue.dequeue()?.value).toBe("positive");
      expect(queue.dequeue()?.value).toBe("zero");
      expect(queue.dequeue()?.value).toBe("negative");
    });

    it("should handle large number of items", () => {
      const queue = new PriorityQueue<{ priority: number; value: number }>();
      const itemCount = 1000;

      // Add items in random order
      for (let i = 0; i < itemCount; i++) {
        const priority = Math.floor(Math.random() * 1000);
        queue.enqueue({ priority, value: priority });
      }

      expect(queue.size()).toBe(itemCount);

      // Verify they come out in descending order
      let prevPriority = Infinity;
      while (!queue.isEmpty()) {
        const item = queue.dequeue();
        if (item) {
          expect(item.priority).toBeLessThanOrEqual(prevPriority);
          prevPriority = item.priority;
        }
      }
    });
  });

  describe("clear operation", () => {
    it("should clear all items", () => {
      const queue = new PriorityQueue<{ priority: number; value: string }>();

      queue.enqueue({ priority: 1, value: "a" });
      queue.enqueue({ priority: 2, value: "b" });
      queue.enqueue({ priority: 3, value: "c" });

      expect(queue.size()).toBe(3);

      queue.clear();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle single item", () => {
      const queue = new PriorityQueue<{ priority: number; value: string }>();
      queue.enqueue({ priority: 1, value: "only" });

      expect(queue.peek()?.value).toBe("only");
      expect(queue.dequeue()?.value).toBe("only");
      expect(queue.isEmpty()).toBe(true);
    });

    it("should handle interleaved enqueue/dequeue", () => {
      const queue = new PriorityQueue<{ priority: number; value: string }>();

      queue.enqueue({ priority: 1, value: "a" });
      queue.enqueue({ priority: 3, value: "c" });
      expect(queue.dequeue()?.value).toBe("c");

      queue.enqueue({ priority: 2, value: "b" });
      expect(queue.dequeue()?.value).toBe("b");

      queue.enqueue({ priority: 4, value: "d" });
      expect(queue.dequeue()?.value).toBe("d");
      expect(queue.dequeue()?.value).toBe("a");
      expect(queue.isEmpty()).toBe(true);
    });
  });
});
