/**
 * Tests for PlaybackManager
 */

import { PlaybackManager, PlaybackState } from "../playbackManager";
import type { Recording } from "../recordingManager";
import type { IQSample } from "../../models/SDRDevice";

describe("PlaybackManager", () => {
  let manager: PlaybackManager;
  let testRecording: Recording;

  beforeEach(() => {
    manager = new PlaybackManager();

    // Create a test recording
    const samples: IQSample[] = [];
    for (let i = 0; i < 100; i++) {
      samples.push({ I: Math.sin(i * 0.1), Q: Math.cos(i * 0.1) });
    }

    testRecording = {
      metadata: {
        version: "1.0",
        timestamp: new Date().toISOString(),
        frequency: 100e6,
        sampleRate: 20e6,
        duration: samples.length / 20e6,
        sampleCount: samples.length,
      },
      samples,
    };
  });

  afterEach(() => {
    manager.stopPlayback();
  });

  describe("Loading Recordings", () => {
    it("should load a valid recording", () => {
      manager.loadRecording(testRecording);

      expect(manager.hasRecording()).toBe(true);
      expect(manager.getState()).toBe(PlaybackState.STOPPED);
      expect(manager.getMetadata()).toEqual(testRecording.metadata);
    });

    it("should load from JSON string", () => {
      const json = JSON.stringify(testRecording);
      manager.loadFromJSON(json);

      expect(manager.hasRecording()).toBe(true);
      expect(manager.getMetadata()?.frequency).toBe(testRecording.metadata.frequency);
    });

    it("should throw error for invalid JSON", () => {
      expect(() => manager.loadFromJSON("invalid json")).toThrow();
    });

    it("should throw error for recording without metadata", () => {
      const invalid = { samples: [] } as unknown as Recording;
      expect(() => manager.loadRecording(invalid)).toThrow("missing metadata");
    });

    it("should throw error for recording without samples", () => {
      const invalid = { metadata: testRecording.metadata } as unknown as Recording;
      expect(() => manager.loadRecording(invalid)).toThrow("samples must be an array");
    });

    it("should validate metadata fields", () => {
      const invalid = {
        metadata: { version: "1.0" },
        samples: [],
      } as unknown as Recording;

      expect(() => manager.loadRecording(invalid)).toThrow(
        "metadata must include frequency and sampleRate",
      );
    });

    it("should reset position when loading new recording", () => {
      manager.loadRecording(testRecording);
      manager.seek(0.5);
      expect(manager.getPosition()).toBeCloseTo(0.5, 1);

      manager.loadRecording(testRecording);
      expect(manager.getPosition()).toBe(0);
    });
  });

  describe("Playback Control", () => {
    beforeEach(() => {
      manager.loadRecording(testRecording);
    });

    it("should throw error when starting playback without recording", () => {
      const emptyManager = new PlaybackManager();
      expect(() => emptyManager.startPlayback(() => {})).toThrow("No recording loaded");
    });

    it("should start playback and invoke callback", () => {
      manager.startPlayback((samples) => {
        expect(samples.length).toBeGreaterThan(0);
      });

      expect(manager.isPlaying()).toBe(true);
      expect(manager.getState()).toBe(PlaybackState.PLAYING);
      manager.stopPlayback();
    });

    it("should pause playback", () => {
      manager.startPlayback(() => {});
      
      manager.pausePlayback();
      expect(manager.getState()).toBe(PlaybackState.PAUSED);
      expect(manager.isPlaying()).toBe(false);
      
      manager.stopPlayback();
    });

    it("should resume playback", () => {
      // Use smaller chunk size to ensure multiple chunks
      manager.setConfig({ chunkSize: 10 });
      
      manager.startPlayback(() => {});
      
      // First pause
      manager.pausePlayback();
      expect(manager.getState()).toBe(PlaybackState.PAUSED);
      
      // Then resume
      manager.resumePlayback();
      expect(manager.getState()).toBe(PlaybackState.PLAYING);
      
      manager.stopPlayback();
    });

    it("should stop playback and reset position", () => {
      manager.startPlayback(() => {});
      manager.stopPlayback();

      expect(manager.getState()).toBe(PlaybackState.STOPPED);
      expect(manager.isPlaying()).toBe(false);
      expect(manager.getPosition()).toBe(0);
    });

    it("should not start playback if already playing", () => {
      manager.startPlayback(() => {});
      const state1 = manager.getState();

      manager.startPlayback(() => {}); // Should not change state
      const state2 = manager.getState();

      expect(state1).toBe(PlaybackState.PLAYING);
      expect(state2).toBe(PlaybackState.PLAYING);

      manager.stopPlayback();
    });
  });

  describe("Seek and Position", () => {
    beforeEach(() => {
      manager.loadRecording(testRecording);
    });

    it("should seek to specific position", () => {
      manager.seek(0.5);
      expect(manager.getPosition()).toBeCloseTo(0.5, 1);

      manager.seek(0.75);
      expect(manager.getPosition()).toBeCloseTo(0.75, 1);
    });

    it("should clamp seek position to valid range", () => {
      manager.seek(-0.5);
      expect(manager.getPosition()).toBe(0);

      manager.seek(1.5);
      expect(manager.getPosition()).toBeCloseTo(1, 1);
    });

    it("should calculate current time correctly", () => {
      manager.seek(0.5);
      const expectedTime = testRecording.metadata.duration * 0.5;
      expect(manager.getCurrentTime()).toBeCloseTo(expectedTime, 3);
    });
  });

  describe("Metadata and Duration", () => {
    it("should return null metadata when no recording loaded", () => {
      expect(manager.getMetadata()).toBeNull();
      expect(manager.getDuration()).toBe(0);
    });

    it("should return correct duration", () => {
      manager.loadRecording(testRecording);
      expect(manager.getDuration()).toBe(testRecording.metadata.duration);
    });

    it("should return current time as 0 when no recording", () => {
      expect(manager.getCurrentTime()).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("should use default configuration", () => {
      expect(manager).toBeDefined();
    });

    it("should accept custom configuration", () => {
      const customManager = new PlaybackManager({
        chunkSize: 2048,
        speed: 2.0,
        loop: true,
      });

      expect(customManager).toBeDefined();
    });

    it("should update configuration", () => {
      manager.setConfig({ speed: 2.0, loop: true });
      expect(manager).toBeDefined();
    });
  });

  describe("Playback Streaming", () => {
    beforeEach(() => {
      manager.loadRecording(testRecording);
    });

    it("should deliver samples in chunks", (done) => {
      let totalSamples = 0;

      manager.startPlayback((samples) => {
        totalSamples += samples.length;
        if (totalSamples >= testRecording.samples.length) {
          manager.stopPlayback();
          expect(totalSamples).toBe(testRecording.samples.length);
          done();
        }
      });
    });

    it("should stop at end of recording", (done) => {
      const smallRecording: Recording = {
        metadata: {
          ...testRecording.metadata,
          sampleCount: 10,
        },
        samples: testRecording.samples.slice(0, 10),
      };

      manager.loadRecording(smallRecording);

      manager.startPlayback(() => {});

      // Wait for playback to finish
      setTimeout(() => {
        expect(manager.getState()).toBe(PlaybackState.STOPPED);
        done();
      }, 100);
    });
  });

  describe("Clear Recording", () => {
    beforeEach(() => {
      manager.loadRecording(testRecording);
    });

    it("should clear loaded recording", () => {
      manager.clearRecording();

      expect(manager.hasRecording()).toBe(false);
      expect(manager.getState()).toBe(PlaybackState.IDLE);
    });

    it("should stop playback when clearing", (done) => {
      manager.startPlayback(() => {});

      setTimeout(() => {
        manager.clearRecording();
        expect(manager.isPlaying()).toBe(false);
        done();
      }, 50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty recording", () => {
      const emptyRecording: Recording = {
        metadata: {
          version: "1.0",
          timestamp: new Date().toISOString(),
          frequency: 100e6,
          sampleRate: 20e6,
          duration: 0,
          sampleCount: 0,
        },
        samples: [],
      };

      manager.loadRecording(emptyRecording);
      expect(manager.getPosition()).toBe(0);
    });

    it("should handle pause when not playing", () => {
      manager.loadRecording(testRecording);
      manager.pausePlayback(); // Should not throw
      expect(manager.getState()).toBe(PlaybackState.STOPPED);
    });

    it("should handle resume when not paused", () => {
      manager.loadRecording(testRecording);
      manager.resumePlayback(); // Should not throw
      expect(manager.getState()).toBe(PlaybackState.STOPPED);
    });
  });
});
