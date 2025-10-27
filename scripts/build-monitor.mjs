#!/usr/bin/env node

/**
 * Build Performance Monitor
 * 
 * Tracks and reports build metrics for rad.io pipeline optimization.
 * 
 * Usage:
 *   node scripts/build-monitor.mjs [command]
 * 
 * Commands:
 *   benchmark  - Run comprehensive build benchmarks
 *   analyze    - Analyze current build artifacts
 *   compare    - Compare with previous build metrics
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

class BuildMonitor {
  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      builds: {},
      artifacts: {},
    };
  }

  /**
   * Execute command and measure time
   */
  timeCommand(name, command) {
    console.log(`\n⏱️  Running: ${name}`);
    const start = Date.now();

    try {
      execSync(command, {
        cwd: rootDir,
        stdio: "inherit",
        env: { ...process.env, FORCE_COLOR: "0" },
      });
      const duration = Date.now() - start;
      console.log(`✅ Completed in ${duration}ms`);
      return { success: true, duration };
    } catch (error) {
      const duration = Date.now() - start;
      console.log(`❌ Failed after ${duration}ms`);
      return { success: false, duration, error: error.message };
    }
  }

  /**
   * Get file size in bytes
   */
  getFileSize(path) {
    try {
      const stats = statSync(join(rootDir, path));
      return stats.size;
    } catch {
      return null;
    }
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Analyze bundle size and composition
   */
  analyzeBundleSize() {
    const files = {
      js: [],
      wasm: [],
      other: [],
    };

    try {
      const entries = execSync("ls -lh dist/", { cwd: rootDir, encoding: "utf8" });
      const lines = entries.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        if (line.startsWith("total")) continue;
        if (line.startsWith("d")) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;

        const size = parts[4];
        const name = parts.slice(8).join(" ");

        if (name.endsWith(".js")) {
          files.js.push({ name, size, bytes: this.getFileSize(`dist/${name}`) });
        } else if (name.endsWith(".wasm")) {
          files.wasm.push({ name, size, bytes: this.getFileSize(`dist/${name}`) });
        } else {
          files.other.push({ name, size, bytes: this.getFileSize(`dist/${name}`) });
        }
      }

      const totalJs = files.js.reduce((sum, f) => sum + (f.bytes || 0), 0);
      const totalWasm = files.wasm.reduce((sum, f) => sum + (f.bytes || 0), 0);
      const totalOther = files.other.reduce((sum, f) => sum + (f.bytes || 0), 0);
      const totalAll = totalJs + totalWasm + totalOther;

      this.metrics.artifacts.bundle = {
        javascript: {
          files: files.js.length,
          bytes: totalJs,
          human: this.formatBytes(totalJs),
        },
        wasm: {
          files: files.wasm.length,
          bytes: totalWasm,
          human: this.formatBytes(totalWasm),
        },
        other: {
          files: files.other.length,
          bytes: totalOther,
          human: this.formatBytes(totalOther),
        },
        total: {
          files: files.js.length + files.wasm.length + files.other.length,
          bytes: totalAll,
          human: this.formatBytes(totalAll),
        },
        breakdown: {
          js: files.js.sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 5),
          wasm: files.wasm,
        },
      };
    } catch (error) {
      console.error("Error analyzing bundle:", error.message);
    }
  }

  /**
   * Analyze current build artifacts
   */
  analyze() {
    console.log("🔍 Analyzing Build Artifacts");
    console.log("=".repeat(70));

    if (existsSync(join(rootDir, "build"))) {
      const debugWasm = this.getFileSize("build/debug.wasm");
      const releaseWasm = this.getFileSize("build/release.wasm");

      console.log("\n⚡ WASM Artifacts:");
      console.log(`  Debug:    ${this.formatBytes(debugWasm)}`);
      console.log(`  Release:  ${this.formatBytes(releaseWasm)}`);
      if (debugWasm && releaseWasm) {
        const compression = ((1 - releaseWasm / debugWasm) * 100).toFixed(2);
        console.log(`  Savings:  ${compression}%`);
      }
    }

    if (existsSync(join(rootDir, "dist"))) {
      this.analyzeBundleSize();
      if (this.metrics.artifacts.bundle) {
        const bundle = this.metrics.artifacts.bundle;
        console.log("\n📦 Bundle Analysis:");
        console.log(`  Total:       ${bundle.total.human}`);
        console.log(`  JavaScript:  ${bundle.javascript.human}`);
        console.log(`  WebAssembly: ${bundle.wasm.human}`);
        console.log(`  Other:       ${bundle.other.human}`);

        console.log("\n  Top JavaScript files:");
        for (const file of bundle.breakdown.js.slice(0, 5)) {
          console.log(`    ${file.name.padEnd(45)} ${file.size}`);
        }
      }
    }

    console.log("\n" + "=".repeat(70));
  }
}

// Main CLI
const command = process.argv[2] || "help";
const monitor = new BuildMonitor();

switch (command) {
  case "analyze":
    monitor.analyze();
    break;

  default:
    console.log(`
Build Performance Monitor

Usage: node scripts/build-monitor.mjs [command]

Commands:
  analyze    - Analyze current build artifacts

Examples:
  node scripts/build-monitor.mjs analyze
    `);
}
