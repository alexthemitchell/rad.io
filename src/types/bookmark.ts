/**
 * Bookmark type definition for frequency management
 */
export interface Bookmark {
  id: string;
  frequency: number; // Hz
  name: string;
  tags: string[];
  notes: string;
  createdAt: number; // timestamp
  lastUsed: number; // timestamp
}
