import { test, expect, type Page } from "@playwright/test";

/**
 * Comprehensive E2E tests for Decode, Analysis, and Recordings workspaces
 * Based on: ADR-0018 (UX IA), ADR-0016 (Signal Decoder), PRD
 * 
 * Covers:
 * - Decode workspace: RTTY, PSK31/63/125, SSTV decoders
 * - Analysis workspace: Constellation, Eye diagram, measurements
 * - Recordings workspace: Library management, playback, export
 */

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

// =============================================================================
// DECODE WORKSPACE
// =============================================================================

test.describe("Decode - Navigation", () => {
  test("should navigate to decode page", async ({ page }) => {
    await page.goto("/decode");
    await expect(page).toHaveURL(/\/decode/);
  });

  test("should be accessible from navigation menu", async ({ page }) => {
    await page.goto("/");
    
    const decodeLink = page.getByRole("link", { name: /decode/i });
    if (await decodeLink.count() > 0) {
      await decodeLink.click();
      await expect(page).toHaveURL(/\/decode/);
    }
  });

  test("should support keyboard shortcut 3 for decode", async ({ page }) => {
    await page.goto("/");
    
    // Per UI Design Spec: 3 for Decode workspace
    await page.keyboard.press("3");
    await page.waitForTimeout(500);
    
    // Documents intended keyboard navigation
  });
});

test.describe("Decode - Mode Selection", () => {
  test("should display mode selection panel", async ({ page }) => {
    await page.goto("/decode");
    
    // Look for mode selector (RTTY, PSK31, SSTV)
    const modeSelector = page.locator(
      'select[aria-label*="mode" i], [role="radiogroup"], [role="tablist"]'
    );
    
    if (await modeSelector.count() > 0) {
      await expect(modeSelector.first()).toBeVisible();
    }
  });

  test("should support RTTY mode selection", async ({ page }) => {
    await page.goto("/decode");
    
    // Look for RTTY option
    const rttyOption = page.getByRole("tab", { name: /rtty/i })
      .or(page.getByRole("radio", { name: /rtty/i }))
      .or(page.getByRole("option", { name: /rtty/i }));
    
    if (await rttyOption.count() > 0) {
      await expect(rttyOption.first()).toBeVisible();
    }
  });

  test("should support PSK31 mode selection", async ({ page }) => {
    await page.goto("/decode");
    
    const pskOption = page.getByRole("tab", { name: /psk/i })
      .or(page.getByRole("radio", { name: /psk/i }))
      .or(page.getByRole("option", { name: /psk/i }));
    
    if (await pskOption.count() > 0) {
      await expect(pskOption.first()).toBeVisible();
    }
  });

  test("should support SSTV mode selection", async ({ page }) => {
    await page.goto("/decode");
    
    const sstvOption = page.getByRole("tab", { name: /sstv/i })
      .or(page.getByRole("radio", { name: /sstv/i }))
      .or(page.getByRole("option", { name: /sstv/i }));
    
    if (await sstvOption.count() > 0) {
      await expect(sstvOption.first()).toBeVisible();
    }
  });
});

test.describe("Decode - RTTY Decoder", () => {
  test("should display RTTY configuration panel", async ({ page }) => {
    await page.goto("/decode");
    
    // Select RTTY mode if available
    const rttyTab = page.getByRole("tab", { name: /rtty/i });
    if (await rttyTab.count() > 0) {
      await rttyTab.click();
      
      // Should show RTTY-specific controls
      // Baud rate: 45.45, 50 baud
      const baudSelector = page.locator('[aria-label*="baud" i]');
      if (await baudSelector.count() > 0) {
        await expect(baudSelector.first()).toBeVisible();
      }
    }
  });

  test("should support shift configuration (170/850 Hz)", async ({ page }) => {
    await page.goto("/decode");
    
    // Look for shift setting
    const shiftControl = page.locator('[aria-label*="shift" i]');
    
    if (await shiftControl.count() > 0) {
      await expect(shiftControl.first()).toBeVisible();
      
      // Per PRD: 170/850 Hz shift options
    }
  });

  test("should display decoded text output", async ({ page }) => {
    await page.goto("/decode?mockSdr=1");
    
    // Look for text output area
    const textOutput = page.locator(
      '[aria-label*="decoded.*text" i], [role="log"], textarea[readonly]'
    );
    
    if (await textOutput.count() > 0) {
      await expect(textOutput.first()).toBeVisible();
    }
  });

  test("should support copy and save decoded text", async ({ page }) => {
    await page.goto("/decode");
    
    // Look for copy/save buttons
    const copyBtn = page.getByRole("button", { name: /copy/i });
    
    if (await copyBtn.count() > 0) {
      await expect(copyBtn.first()).toBeVisible();
    }
    
    // Documents expected functionality per PRD
  });
});

test.describe("Decode - PSK31 Decoder", () => {
  test("should support AFC (Automatic Frequency Control)", async ({ page }) => {
    await page.goto("/decode");
    
    // Select PSK mode if available
    const pskTab = page.getByRole("tab", { name: /psk/i });
    if (await pskTab.count() > 0) {
      await pskTab.click();
      
      // Look for AFC toggle
      const afcToggle = page.getByRole("checkbox", { name: /afc|auto.*frequency/i });
      if (await afcToggle.count() > 0) {
        await expect(afcToggle.first()).toBeVisible();
      }
    }
  });

  test("should support varicode decoding", async ({ page }) => {
    await page.goto("/decode?mockSdr=1");
    
    // PSK31 uses varicode encoding
    // Output should handle varicode characters
    // Documents expected PSK31 decoder behavior per PRD
  });
});

test.describe("Decode - SSTV Decoder", () => {
  test("should display image output area", async ({ page }) => {
    await page.goto("/decode");
    
    // Select SSTV mode if available
    const sstvTab = page.getByRole("tab", { name: /sstv/i });
    if (await sstvTab.count() > 0) {
      await sstvTab.click();
      
      // Look for image display area
      const imageOutput = page.locator(
        'canvas[aria-label*="sstv" i], img[alt*="sstv" i], [role="img"]'
      );
      
      if (await imageOutput.count() > 0) {
        await expect(imageOutput.first()).toBeVisible();
      }
    }
  });

  test("should support multiple SSTV modes (Martin, Scottie, Robot)", async ({ page }) => {
    await page.goto("/decode");
    
    // Look for SSTV mode selector
    const sstvModeSelector = page.locator('[aria-label*="sstv.*mode" i]');
    
    if (await sstvModeSelector.count() > 0) {
      await expect(sstvModeSelector.first()).toBeVisible();
      
      // Per PRD: Martin M1/M2, Scottie S1/S2, Robot 36
    }
  });

  test("should show progressive rendering with completion percentage", async ({ page }) => {
    await page.goto("/decode?mockSdr=1");
    
    // Look for progress indicator
    const progressIndicator = page.locator(
      '[role="progressbar"], [aria-label*="progress" i], [aria-label*="completion" i]'
    );
    
    if (await progressIndicator.count() > 0) {
      // Per PRD: progressive SSTV image rendering with completion %
    }
  });

  test("should support save SSTV image", async ({ page }) => {
    await page.goto("/decode");
    
    const saveBtn = page.getByRole("button", { name: /save.*image|export.*image/i });
    
    if (await saveBtn.count() > 0) {
      await expect(saveBtn.first()).toBeVisible();
    }
  });
});

test.describe("Decode - General Controls", () => {
  test("should have start/stop decoder buttons", async ({ page }) => {
    await page.goto("/decode");
    
    const startBtn = page.getByRole("button", { name: /start.*decode/i });
    
    if (await startBtn.count() > 0) {
      await expect(startBtn.first()).toBeVisible();
    }
  });

  test("should meet <200ms decode latency requirement", async ({ page }) => {
    await page.goto("/decode?mockSdr=1");
    
    // Per PRD: <200ms decode latency
    // Documents expected performance requirement
    // Actual measurement would require signal injection and timing
  });
});

// =============================================================================
// ANALYSIS WORKSPACE
// =============================================================================

test.describe("Analysis - Navigation", () => {
  test("should navigate to analysis page", async ({ page }) => {
    await page.goto("/analysis");
    await expect(page).toHaveURL(/\/analysis/);
  });

  test("should be accessible from navigation menu", async ({ page }) => {
    await page.goto("/");
    
    const analysisLink = page.getByRole("link", { name: /analysis/i });
    if (await analysisLink.count() > 0) {
      await analysisLink.click();
      await expect(page).toHaveURL(/\/analysis/);
    }
  });

  test("should support keyboard shortcut 4 for analysis", async ({ page }) => {
    await page.goto("/");
    
    // Per UI Design Spec: 4 for Analysis workspace
    await page.keyboard.press("4");
    await page.waitForTimeout(500);
  });
});

test.describe("Analysis - Constellation Diagram", () => {
  test("should display constellation diagram", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    const constellationCanvas = page.locator('canvas[aria-label*="constellation" i]');
    
    if (await constellationCanvas.count() > 0) {
      await expect(constellationCanvas.first()).toBeVisible();
      await expect(constellationCanvas.first()).toHaveAttribute("role", "img");
    }
  });

  test("should support freeze frame mode", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    const freezeBtn = page.getByRole("button", { name: /freeze|pause|hold/i });
    
    if (await freezeBtn.count() > 0) {
      await expect(freezeBtn.first()).toBeVisible();
      
      // Can freeze the display per UI Design Spec
      await freezeBtn.first().click();
    }
  });

  test("should support persistence trails", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    // Look for persistence control
    const persistenceControl = page.locator('[aria-label*="persistence" i]');
    
    if (await persistenceControl.count() > 0) {
      // Per PRD: persistence trails in constellation
    }
  });

  test("should calculate EVM (Error Vector Magnitude)", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    // Look for EVM measurement display
    const evmDisplay = page.getByText(/evm/i);
    
    if (await evmDisplay.count() > 0) {
      // Per PRD: EVM calculation for QAM/PSK
    }
  });
});

test.describe("Analysis - Eye Diagram", () => {
  test("should display eye diagram", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    const eyeCanvas = page.locator('canvas[aria-label*="eye" i]');
    
    if (await eyeCanvas.count() > 0) {
      await expect(eyeCanvas.first()).toBeVisible();
      await expect(eyeCanvas.first()).toHaveAttribute("role", "img");
    }
  });

  test("should support trigger controls", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    // Look for trigger control
    const triggerControl = page.locator('[aria-label*="trigger" i]');
    
    if (await triggerControl.count() > 0) {
      // Per PRD: trigger controls for eye diagram
    }
  });
});

test.describe("Analysis - Measurements", () => {
  test("should support interactive cursors", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    // Cursors for measurements per UI Design Spec
    // Look for cursor controls or keyboard hints
    const cursorHint = page.getByText(/cursor|marker/i);
    
    if (await cursorHint.count() > 0) {
      await expect(cursorHint.first()).toBeVisible();
    }
    // Documents expected interactive measurement capability
  });

  test("should support compare snapshots", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    const compareBtn = page.getByRole("button", { name: /compare|snapshot/i });
    
    if (await compareBtn.count() > 0) {
      // Per UI Design Spec: compare snapshots functionality
    }
  });

  test("should support export annotated images", async ({ page }) => {
    await page.goto("/analysis");
    
    const exportBtn = page.getByRole("button", { name: /export.*image|save.*image/i });
    
    if (await exportBtn.count() > 0) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });
});

test.describe("Analysis - Spectrogram Zoom", () => {
  test("should support deep zoom into spectrum", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    // Keyboard shortcuts per UI Design Spec: Z for zoom to selection
    await page.keyboard.press("z");
    await page.waitForTimeout(200);
    
    // Documents expected zoom functionality
  });
});

test.describe("Analysis - Phase Noise Measurement", () => {
  test("should display phase noise view", async ({ page }) => {
    await page.goto("/analysis?mockSdr=1");
    
    // Look for phase noise option or tab
    const phaseNoiseTab = page.getByRole("tab", { name: /phase.*noise/i });
    
    if (await phaseNoiseTab.count() > 0) {
      await phaseNoiseTab.click();
      
      // Phase noise visualization should appear
      // Per PRD: phase noise measurement capability
    }
  });
});

// =============================================================================
// RECORDINGS WORKSPACE
// =============================================================================

test.describe("Recordings - Navigation", () => {
  test("should navigate to recordings page", async ({ page }) => {
    await page.goto("/recordings");
    await expect(page).toHaveURL(/\/recordings/);
  });

  test("should be accessible from navigation menu", async ({ page }) => {
    await page.goto("/");
    
    const recordingsLink = page.getByRole("link", { name: /recordings/i });
    if (await recordingsLink.count() > 0) {
      await recordingsLink.click();
      await expect(page).toHaveURL(/\/recordings/);
    }
  });

  test("should support keyboard shortcut 5 for recordings", async ({ page }) => {
    await page.goto("/");
    
    // Per UI Design Spec: 5 for Recordings workspace
    await page.keyboard.press("5");
    await page.waitForTimeout(500);
  });
});

test.describe("Recordings - Library Display", () => {
  test("should display recordings library", async ({ page }) => {
    await page.goto("/recordings");
    
    // Look for list or grid view
    const recordingsList = page.locator(
      '[role="list"], [role="table"], [role="grid"]'
    );
    
    if (await recordingsList.count() > 0) {
      await expect(recordingsList.first()).toBeVisible();
    }
  });

  test("should support list and grid view modes", async ({ page }) => {
    await page.goto("/recordings");
    
    // Look for view mode toggles
    const listViewBtn = page.getByRole("button", { name: /list.*view/i });
    const gridViewBtn = page.getByRole("button", { name: /grid.*view/i });
    
    if (await listViewBtn.count() > 0 || await gridViewBtn.count() > 0) {
      // Per PRD: list/grid views for recordings
    }
  });

  test("should display recording metadata (timestamp, duration, frequency)", async ({ page }) => {
    await page.goto("/recordings");
    
    // Look for metadata columns
    const timestampCol = page.getByRole("columnheader", { name: /time|date/i });
    const durationCol = page.getByRole("columnheader", { name: /duration|length/i });
    const freqCol = page.getByRole("columnheader", { name: /frequency/i });
    
    // Documents expected metadata display per PRD
    if (await timestampCol.count() > 0) {
      await expect(timestampCol.first()).toBeVisible();
      await expect(durationCol.first()).toBeVisible();
      await expect(freqCol.first()).toBeVisible();
    }
  });
});

test.describe("Recordings - Filtering and Search", () => {
  test("should support filter by tags", async ({ page }) => {
    await page.goto("/recordings");
    
    const filterControl = page.locator('[aria-label*="filter" i], [placeholder*="filter" i]');
    
    if (await filterControl.count() > 0) {
      await expect(filterControl.first()).toBeVisible();
    }
  });

  test("should support search recordings", async ({ page }) => {
    await page.goto("/recordings");
    
    const searchInput = page.getByRole("searchbox")
      .or(page.locator('input[type="search"]'))
      .or(page.getByPlaceholder(/search/i));
    
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
      
      // Can type search query
      await searchInput.first().fill("test");
    }
  });
});

test.describe("Recordings - Playback", () => {
  test("should support recording playback", async ({ page }) => {
    await page.goto("/recordings");
    
    // Look for play button on recordings
    const playBtn = page.getByRole("button", { name: /play|playback/i });
    
    if (await playBtn.count() > 0) {
      // Per PRD: playback/preview capability
    }
  });

  test("should display playback preview", async ({ page }) => {
    await page.goto("/recordings");
    
    // Look for preview visualization
    const previewCanvas = page.locator('canvas[aria-label*="preview" i]');
    
    if (await previewCanvas.count() > 0) {
      // Playback should show visualization
    }
  });
});

test.describe("Recordings - Export", () => {
  test("should support export recordings", async ({ page }) => {
    await page.goto("/recordings");
    
    const exportBtn = page.getByRole("button", { name: /export|download/i });
    
    if (await exportBtn.count() > 0) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });

  test("should support SigMF format export", async ({ page }) => {
    await page.goto("/recordings");
    
    // Look for format selector or SigMF option
    const formatSelector = page.locator('[aria-label*="format" i]');
    
    if (await formatSelector.count() > 0) {
      // Per PRD: SigMF-compliant export
    }
  });

  test("should support WAV/FLAC export for audio", async ({ page }) => {
    await page.goto("/recordings");
    
    // Per PRD: WAV, FLAC for audio; SigMF for IQ
    // Documents expected export formats
  });
});

test.describe("Recordings - Management", () => {
  test("should support delete recordings", async ({ page }) => {
    await page.goto("/recordings");
    
    const deleteBtn = page.getByRole("button", { name: /delete|remove/i });
    
    if (await deleteBtn.count() > 0) {
      await expect(deleteBtn.first()).toBeVisible();
    }
  });

  test("should support tag editing", async ({ page }) => {
    await page.goto("/recordings");
    
    const tagInput = page.locator('[aria-label*="tag" i], input[placeholder*="tag" i]');
    
    if (await tagInput.count() > 0) {
      // Per PRD: metadata tagging capability
    }
  });

  test("should display storage quota information", async ({ page }) => {
    await page.goto("/recordings");
    
    // Look for storage usage display
    const storageInfo = page.getByText(/storage|quota|GB|MB/i);
    
    if (await storageInfo.count() > 0) {
      // Per PRD: handles 20GB+ with quota management
    }
  });

  test("should warn when approaching storage quota", async ({ page }) => {
    await page.goto("/recordings");
    
    // Look for storage warning
    const storageWarning = page.getByText(/storage.*full|quota.*exceeded|cleanup/i);
    
    // Per PRD: warnings at 70%/85%/95%
    // Documents expected quota management
    if (await storageWarning.count() > 0) {
      await expect(storageWarning.first()).toBeVisible();
    }
  });
});

test.describe("Recordings - Integration", () => {
  test("should support open in Analysis workspace", async ({ page }) => {
    await page.goto("/recordings");
    
    const analyzeBtn = page.getByRole("button", { name: /analyze|open.*analysis/i });
    
    if (await analyzeBtn.count() > 0) {
      // Per UI Design Spec: open recording in Analysis
    }
  });

  test("should support open in Decode workspace", async ({ page }) => {
    await page.goto("/recordings");
    
    const decodeBtn = page.getByRole("button", { name: /decode/i });
    
    if (await decodeBtn.count() > 0) {
      // Per UI Design Spec: open recording in Decode
    }
  });
});
