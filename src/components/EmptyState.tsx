type EmptyStateProps = {
  width?: number | string;
  height?: number | string;
  title: string;
  message: string;
};

/**
 * Empty state placeholder component for visualizations
 * Shows a centered message when no data is available
 */
function EmptyState({
  width = "100%",
  height = 400,
  title,
  message,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1d23",
        color: "#a0aab5",
        fontSize: "16px",
        textAlign: "center",
        padding: "20px",
        borderRadius: "4px",
      }}
    >
      <div>
        <p style={{ margin: 0, marginBottom: "8px", fontWeight: 500 }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: "14px" }}>{message}</p>
      </div>
    </div>
  );
}

export default EmptyState;
