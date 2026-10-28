// Turns a level grid into hidden setup code that the engine runs when the level loads.
import type { Level } from './model';
import { parseCellKey } from './model';

export function levelSetupCode(level: Level): string {
  const settings = {
    cols: level.cols,
    rows: level.rows,
    mode: level.mode,
    view: level.view,
    background: level.background,
  };
  const lines = [`$g.setupLevel(${JSON.stringify(settings)});`];
  const cells = Object.entries(level.cells)
    .map(([key, asset]) => [...parseCellKey(key), asset] as [number, number, string])
    .filter(([x, y]) => x < level.cols && y < level.rows)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [x, y, asset] of cells) lines.push(`$g.spawn(${JSON.stringify(asset)}, ${x}, ${y});`);
  return lines.join('\n') + '\n';
}
