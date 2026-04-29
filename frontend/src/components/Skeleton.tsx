interface BlockProps {
  height?: number | string;
  width?: number | string;
  rounded?: boolean | number;
  style?: React.CSSProperties;
}

export function SkeletonLine({ height = 14, width = '100%', rounded = true, style }: BlockProps) {
  return (
    <div
      className="skeleton"
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
        borderRadius: rounded === true ? 8 : typeof rounded === 'number' ? rounded : undefined,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div className="card" style={{ minHeight: height }}>
      <SkeletonLine height={18} width="40%" style={{ marginBottom: 16 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} height={12} width={`${70 + (i * 7) % 25}%`} style={{ marginBottom: 10 }} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="cards-grid">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>{Array.from({ length: cols }).map((_, i) => <th key={i}><SkeletonLine height={10} width={70} /></th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => <td key={c}><SkeletonLine height={12} width={c === 0 ? 140 : 80} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
