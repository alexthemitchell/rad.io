/**
 * Frequency Marker Management
 * Implements marker placement, tracking, and delta measurements
 */

import type { FrequencyMarker, MarkerDelta, MeasurementConfig } from "./types";

/**
 * Manages frequency markers on spectrum displays
 */
export class FrequencyMarkerManager {
  private markers = new Map<string, FrequencyMarker>();
  private config: Required<MeasurementConfig>;
  private nextMarkerId = 1;

  constructor(config?: MeasurementConfig) {
    this.config = {
      maxMarkers: config?.maxMarkers ?? 8,
      markerTrackPeak: config?.markerTrackPeak ?? false,
      integrationMethod: config?.integrationMethod ?? "trapezoidal",
      occupiedBandwidthThreshold: config?.occupiedBandwidthThreshold ?? 0.99,
      noiseFloorSamples: config?.noiseFloorSamples ?? 1000,
      harmonicCount: config?.harmonicCount ?? 5,
      averagingEnabled: config?.averagingEnabled ?? true,
      averagingCount: config?.averagingCount ?? 10,
      averagingMode: config?.averagingMode ?? "exponential",
      applyFrequencyCalibration: config?.applyFrequencyCalibration ?? true,
      applyPowerCalibration: config?.applyPowerCalibration ?? true,
      applyIQCalibration: config?.applyIQCalibration ?? true,
    };
  }

  /**
   * Add a new marker at the specified frequency
   */
  addMarker(
    frequency: number,
    label?: string,
    color?: string,
  ): FrequencyMarker {
    if (this.markers.size >= this.config.maxMarkers) {
      throw new Error(
        `Maximum number of markers (${this.config.maxMarkers}) reached`,
      );
    }

    const id = `M${this.nextMarkerId++}`;
    const marker: FrequencyMarker = {
      id,
      frequency,
      label: label ?? id,
      color: color ?? this.getDefaultMarkerColor(this.markers.size),
      active: true,
    };

    this.markers.set(id, marker);
    return marker;
  }

  /**
   * Remove a marker by ID
   */
  removeMarker(markerId: string): boolean {
    return this.markers.delete(markerId);
  }

  /**
   * Update marker frequency
   */
  updateMarkerFrequency(markerId: string, frequency: number): boolean {
    const marker = this.markers.get(markerId);
    if (!marker) {
      return false;
    }
    marker.frequency = frequency;
    return true;
  }

  /**
   * Update marker power value
   */
  updateMarkerPower(markerId: string, power: number): boolean {
    const marker = this.markers.get(markerId);
    if (!marker) {
      return false;
    }
    marker.power = power;
    return true;
  }

  /**
   * Get marker by ID
   */
  getMarker(markerId: string): FrequencyMarker | undefined {
    return this.markers.get(markerId);
  }

  /**
   * Get all markers
   */
  getAllMarkers(): FrequencyMarker[] {
    return Array.from(this.markers.values());
  }

  /**
   * Get active markers
   */
  getActiveMarkers(): FrequencyMarker[] {
    return Array.from(this.markers.values()).filter((m) => m.active);
  }

  /**
   * Clear all markers
   */
  clearMarkers(): void {
    this.markers.clear();
    this.nextMarkerId = 1;
  }

  /**
   * Move marker to peak within a specified range
   */
  trackPeakInRange(
    markerId: string,
    spectrum: Float32Array,
    frequencies: Float32Array,
    searchRange?: number,
  ): boolean {
    const marker = this.markers.get(markerId);
    if (!marker) {
      return false;
    }

    const centerFreq = marker.frequency;
    const range = searchRange ?? 50000; // Default 50 kHz search range

    // Find indices within search range
    const startFreq = centerFreq - range / 2;
    const endFreq = centerFreq + range / 2;

    let startIdx = 0;
    let endIdx = frequencies.length - 1;

    // Binary search for start index
    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      if (freq === undefined) {
        continue;
      }
      if (freq >= startFreq) {
        startIdx = i;
        break;
      }
    }

    // Binary search for end index
    for (let i = frequencies.length - 1; i >= 0; i--) {
      const freq = frequencies[i];
      if (freq === undefined) {
        continue;
      }
      if (freq <= endFreq) {
        endIdx = i;
        break;
      }
    }

    // Find peak in range
    let peakIdx = startIdx;
    let peakPower = spectrum[startIdx] ?? -Infinity;

    for (let i = startIdx; i <= endIdx; i++) {
      const power = spectrum[i];
      if (power !== undefined && power > peakPower) {
        peakPower = power;
        peakIdx = i;
      }
    }

    // Update marker
    const peakFreq = frequencies[peakIdx];
    if (peakFreq !== undefined) {
      marker.frequency = peakFreq;
      marker.power = peakPower;
      return true;
    }

    return false;
  }

  /**
   * Calculate delta between two markers
   */
  calculateDelta(marker1Id: string, marker2Id: string): MarkerDelta | null {
    const marker1 = this.markers.get(marker1Id);
    const marker2 = this.markers.get(marker2Id);

    if (!marker1 || !marker2) {
      return null;
    }

    return {
      marker1Id,
      marker2Id,
      frequencyDelta: Math.abs(marker2.frequency - marker1.frequency),
      powerDelta:
        marker1.power !== undefined && marker2.power !== undefined
          ? marker2.power - marker1.power
          : undefined,
    };
  }

  /**
   * Get default marker color based on index
   */
  private getDefaultMarkerColor(index: number): string {
    const colors = [
      "#FF6B6B", // Red
      "#4ECDC4", // Cyan
      "#FFE66D", // Yellow
      "#95E1D3", // Mint
      "#F38181", // Pink
      "#AA96DA", // Purple
      "#FCBAD3", // Light pink
      "#A8D8EA", // Light blue
    ];
    return colors[index % colors.length] ?? "#FFFFFF";
  }

  /**
   * Update marker power values from spectrum data
   */
  updateMarkersFromSpectrum(
    spectrum: Float32Array,
    frequencies: Float32Array,
  ): void {
    for (const marker of this.markers.values()) {
      if (!marker.active) {
        continue;
      }

      // Find closest frequency bin
      let closestIdx = 0;
      let minDiff = Infinity;

      for (let i = 0; i < frequencies.length; i++) {
        const freq = frequencies[i];
        if (freq === undefined) {
          continue;
        }
        const diff = Math.abs(freq - marker.frequency);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }

      const power = spectrum[closestIdx];
      if (power !== undefined) {
        marker.power = power;
      }

      // Track peak if enabled
      if (this.config.markerTrackPeak) {
        this.trackPeakInRange(marker.id, spectrum, frequencies);
      }
    }
  }

  /**
   * Toggle marker active state
   */
  toggleMarkerActive(markerId: string): boolean {
    const marker = this.markers.get(markerId);
    if (!marker) {
      return false;
    }
    marker.active = !marker.active;
    return true;
  }

  /**
   * Set marker label
   */
  setMarkerLabel(markerId: string, label: string): boolean {
    const marker = this.markers.get(markerId);
    if (!marker) {
      return false;
    }
    marker.label = label;
    return true;
  }

  /**
   * Set marker color
   */
  setMarkerColor(markerId: string, color: string): boolean {
    const marker = this.markers.get(markerId);
    if (!marker) {
      return false;
    }
    marker.color = color;
    return true;
  }

  /**
   * Export markers to JSON
   */
  exportMarkers(): string {
    return JSON.stringify(Array.from(this.markers.values()), null, 2);
  }

  /**
   * Import markers from JSON
   */
  importMarkers(json: string): boolean {
    try {
      const markers = JSON.parse(json) as FrequencyMarker[];
      this.markers.clear();
      for (const marker of markers) {
        this.markers.set(marker.id, marker);
      }
      return true;
    } catch {
      return false;
    }
  }
}
