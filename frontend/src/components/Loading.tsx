interface Props {
  full?: boolean;
  label?: string;
  size?: number;
}

/**
 * Beautiful Miz-themed loader: rotating gradient ring around a pulsing logo dot.
 * `full` = full-screen overlay; otherwise inline.
 */
export function Loading({ full, label = 'Загрузка…', size = 56 }: Props) {
  const inner = (
    <div className="miz-loader" style={{ ['--size' as any]: `${size}px` }}>
      <div className="miz-loader-ring" />
      <div className="miz-loader-core">M</div>
      {label && <div className="miz-loader-label">{label}</div>}
    </div>
  );
  if (full) return <div className="miz-loader-full">{inner}</div>;
  return inner;
}

/** Tiny inline spinner (e.g. inside buttons). */
export function MiniSpinner({ size = 16 }: { size?: number }) {
  return <span className="miz-spinner" style={{ width: size, height: size }} aria-hidden />;
}
