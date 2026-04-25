interface TreeData {
  level: number;
  completedCount: number;
  withered?: boolean;
  redFrame?: boolean;
}

const STAGES = ['🌱', '🌿', '🌳', '🍀', '🌲', '🌟'];

export function TreeView({ name, tree }: { name?: string; tree?: TreeData | null }) {
  const t = tree || ({ level: 0, completedCount: 0 } as TreeData);
  const stage = t.withered ? '🍂' : STAGES[Math.min(t.level, STAGES.length - 1)];
  return (
    <div className={`tree-card ${t.redFrame ? 'red-frame' : ''} ${t.withered ? 'withered' : ''}`}>
      <div className="tree-vis">{stage}</div>
      {name && <div className="tree-name">{name}</div>}
      <div className="tree-level">
        {t.withered ? 'засохло' : `уровень ${t.level} · ${t.completedCount} ДЗ`}
      </div>
      {t.redFrame && !t.withered && <span title="Просрочка">🪓</span>}
    </div>
  );
}
