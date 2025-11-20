/**
 * Utility functions for formatting data
 */

/**
 * Format bytes to human-readable string (KB, MB, GB)
 * @param bytes Number of bytes
 * @returns Formatted string (e.g., "5.00 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  if (bytes < 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration to human-readable string (mm:ss or hh:mm:ss)
 * @param seconds Duration in seconds
 * @returns Formatted duration string (e.g., "2:05" or "1:30:45")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format timestamp to human-readable date/time string
 * @param isoString ISO 8601 timestamp string
 * @returns Formatted timestamp (e.g., "2h ago" or "Jan 15, 10:30 AM")
 */
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If within last 24 hours, show relative time
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes === 0) {
        return "Just now";
      }
      return `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }

  // Otherwise show formatted date
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}
