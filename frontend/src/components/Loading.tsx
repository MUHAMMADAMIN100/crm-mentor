interface Props {
  full?: boolean;
  label?: string;
  size?: number;
}

/**
 * Branded Miz loader: 3 orbiting petals around a pulsing gradient core,
 * with soft halo glow underneath. CSS-only.
 */
export function Loading({ full, label = 'Загрузка…', size = 84 }: Props) {
  const inner = (
    <div className="miz-loader" style={{ ['--size' as any]: `${size}px` }}>
      <div className="miz-loader-halo" />
      <div className="miz-loader-orbit miz-loader-orbit-1">
        <span className="miz-petal" />
      </div>
      <div className="miz-loader-orbit miz-loader-orbit-2">
        <span className="miz-petal" />
      </div>
      <div className="miz-loader-orbit miz-loader-orbit-3">
        <span className="miz-petal" />
      </div>
      <div className="miz-loader-core">
        <span className="miz-loader-core-inner" />
      </div>
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
