/**
 * Priority Queue Implementation
 * Implements ADR-0012: Parallel FFT Worker Pool
 *
 * Binary heap-based priority queue for task scheduling
 */

export class PriorityQueue<T extends { priority: number }> {
  private heap: T[] = [];

  /**
   * Add an item to the queue
   * @param item Item with priority property
   */
  enqueue(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return the highest priority item
   * @returns Highest priority item or undefined if empty
   */
  dequeue(): T | undefined {
    if (this.isEmpty()) {
      return undefined;
    }

    const result = this.heap[0];
    const end = this.heap.pop();

    if (this.heap.length > 0 && end) {
      this.heap[0] = end;
      this.bubbleDown(0);
    }

    return result;
  }

  /**
   * Get the highest priority item without removing it
   * @returns Highest priority item or undefined if empty
   */
  peek(): T | undefined {
    return this.heap[0];
  }

  /**
   * Check if the queue is empty
   * @returns True if queue is empty
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Get the number of items in the queue
   * @returns Queue size
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * Clear all items from the queue
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * Move an item up the heap to maintain heap property
   * @param index Index of item to bubble up
   */
  private bubbleUp(idx: number): void {
    const item = this.heap[idx];
    if (!item) {
      return;
    }

    let index = idx;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (!parent) {
        break;
      }

      // Higher priority values go to the top
      if (item.priority <= parent.priority) {
        break;
      }

      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = item;
  }

  /**
   * Move an item down the heap to maintain heap property
   * @param idx Index of item to bubble down
   */
  private bubbleDown(idx: number): void {
    const length = this.heap.length;
    const item = this.heap[idx];
    if (!item) {
      return;
    }

    let index = idx;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const leftIndex = 2 * index + 1;
      const rightIndex = 2 * index + 2;
      let swapIndex = -1;

      const leftChild = this.heap[leftIndex];
      const rightChild = this.heap[rightIndex];

      if (
        leftIndex < length &&
        leftChild &&
        leftChild.priority > item.priority
      ) {
        swapIndex = leftIndex;
      }

      const compareItem = swapIndex === -1 ? item : leftChild;
      if (compareItem === undefined) {
        break;
      }

      if (
        rightIndex < length &&
        rightChild &&
        rightChild.priority > compareItem.priority
      ) {
        swapIndex = rightIndex;
      }

      if (swapIndex === -1) {
        break;
      }

      const itemToSwap = this.heap[swapIndex];
      if (!itemToSwap) {
        break;
      }

      this.heap[index] = itemToSwap;
      index = swapIndex;
    }

    this.heap[index] = item;
  }
}
