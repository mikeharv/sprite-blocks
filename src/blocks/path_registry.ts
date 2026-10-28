// Tracks the paths workspace so blocks on the main workspace can list path names.
import type * as Blockly from 'blockly/core';

let pathWorkspace: Blockly.Workspace | null = null;

export function setPathWorkspace(ws: Blockly.Workspace): void {
  pathWorkspace = ws;
}

export function pathDefinitionBlocks(): Blockly.Block[] {
  return pathWorkspace ? pathWorkspace.getBlocksByType('sb_path_def', true) : [];
}

export function pathNames(): string[] {
  const names = pathDefinitionBlocks().map((b) => String(b.getFieldValue('NAME')));
  return [...new Set(names)];
}

/** Returns `base`, or `base 2`, `base 3`… so it does not clash with an existing path name. */
export function uniquePathName(base: string, ignore?: Blockly.Block): string {
  const taken = new Set(
    pathDefinitionBlocks()
      .filter((b) => b !== ignore)
      .map((b) => String(b.getFieldValue('NAME'))),
  );
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}
