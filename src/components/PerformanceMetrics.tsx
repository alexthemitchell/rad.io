import { useEffect, useState } from "react";
import { performanceMonitor } from "../utils/performanceMonitor";

type PerformanceStats = {
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
};

type CategoryStats = {
  [category: string]: PerformanceStats;
};

export default function PerformanceMetrics(): React.JSX.Element {
  const [stats, setStats] = useState<CategoryStats>({});
  const [longTaskCount, setLongTaskCount] = useState(0);
  const [enabled, setEnabled] = useState(true);

  useEffect((): (() => void) => {
    const interval = setInterval(() => {
      const categories = ["fft", "waveform", "spectrogram", "rendering"];
      const newStats: CategoryStats = {};

      categories.forEach((category) => {
        newStats[category] = performanceMonitor.getStats(category);
      });

      setStats(newStats);
      setLongTaskCount(performanceMonitor.getLongTasks().length);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleMonitoring = (): void => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    performanceMonitor.setEnabled(newEnabled);
  };

  const handleClear = (): void => {
    performanceMonitor.clear();
    setStats({});
    setLongTaskCount(0);
  };

  const handleExport = (): void => {
    const exported = performanceMonitor.exportMetrics();
    const blob = new Blob([exported], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `performance-metrics-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="performance-metrics">
      <div className="performance-header">
        <h3>Performance Metrics</h3>
        <div className="performance-controls">
          <button
            onClick={handleToggleMonitoring}
            className={`btn btn-sm ${enabled ? "btn-primary" : "btn-secondary"}`}
          >
            {enabled ? "Monitoring On" : "Monitoring Off"}
          </button>
          <button onClick={handleClear} className="btn btn-sm btn-secondary">
            Clear
          </button>
          <button onClick={handleExport} className="btn btn-sm btn-secondary">
            Export
          </button>
        </div>
      </div>

      <div className="performance-stats-grid">
        {Object.entries(stats).map(([category, stat]) => {
          if (stat.count === 0) {
            return null;
          }

          return (
            <div key={category} className="performance-stat-card">
              <div className="stat-header">{category.toUpperCase()}</div>
              <div className="stat-body">
                <div className="stat-row">
                  <span className="stat-label">Count:</span>
                  <span className="stat-value">{stat.count}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Avg:</span>
                  <span className="stat-value">{stat.avg.toFixed(2)}ms</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">P95:</span>
                  <span className="stat-value">{stat.p95.toFixed(2)}ms</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Max:</span>
                  <span className="stat-value">{stat.max.toFixed(2)}ms</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {longTaskCount > 0 && (
        <div className="long-tasks-warning">
          ⚠️ {longTaskCount} long tasks detected (&gt;50ms)
        </div>
      )}
    </div>
  );
}
