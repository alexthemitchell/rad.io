/**
 * Bookmark Storage Utility
 *
 * Centralized bookmark persistence using localStorage.
 * Provides consistent interface for bookmark CRUD operations.
 *
 * Persistence: localStorage
 * Scope: Application-wide, shared across all tabs
 * Key: "rad.io:bookmarks"
 */

import type { Bookmark } from "../types/bookmark";

export const STORAGE_KEY = "rad.io:bookmarks";

/**
 * Load all bookmarks from localStorage
 */
export function loadBookmarks(): Bookmark[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as Bookmark[];
  } catch {
    // Invalid data, return empty array
    return [];
  }
}

/**
 * Save bookmarks to localStorage
 */
export function saveBookmarks(bookmarks: Bookmark[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

/**
 * Check if a bookmark exists for the given frequency
 */
export function bookmarkExists(frequencyHz: number): Bookmark | undefined {
  const bookmarks = loadBookmarks();
  return bookmarks.find((b) => b.frequency === frequencyHz);
}

/**
 * Add a new bookmark
 * Note: Does not check for duplicates. Caller is responsible for duplicate checking.
 */
export function addBookmark(bookmark: Bookmark): void {
  const bookmarks = loadBookmarks();
  bookmarks.push(bookmark);
  saveBookmarks(bookmarks);
}

/**
 * Remove a bookmark by ID
 */
export function removeBookmark(id: string): void {
  const bookmarks = loadBookmarks();
  const filtered = bookmarks.filter((b) => b.id !== id);
  saveBookmarks(filtered);
}

/**
 * Update an existing bookmark
 */
export function updateBookmark(
  id: string,
  updates: Partial<Omit<Bookmark, "id">>,
): void {
  const bookmarks = loadBookmarks();
  const index = bookmarks.findIndex((b) => b.id === id);
  if (index >= 0) {
    bookmarks[index] = { ...bookmarks[index], ...updates } as Bookmark;
    saveBookmarks(bookmarks);
  }
}
