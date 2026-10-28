// Creates the main and paths Blockly workspaces and keeps them in sync with each other and the levels.
import * as Blockly from 'blockly/core';
import { javascriptGenerator } from 'blockly/javascript';
import { FieldGridLocation } from './blocks/fields';
import { compilePaths } from './blocks/path_blocks';
import { pathNames, setPathWorkspace } from './blocks/path_registry';
import { MAIN_TOOLBOX, PATH_TOOLBOX, registerToolboxCallbacks, theme } from './blocks/toolbox';
import { levelSetupCode } from './compile';
import type { CompiledProgram } from './runtime/engine';
import type { Project } from './model';
import { state } from './state';

let main: Blockly.WorkspaceSvg;
let paths: Blockly.WorkspaceSvg;
let loading = false;

const workspaceOptions = (toolbox: Blockly.utils.toolbox.ToolboxDefinition): Blockly.BlocklyOptions => ({
  toolbox,
  theme,
  renderer: 'thrasos',
  trashcan: true,
  sounds: false,
  zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.3, scaleSpeed: 1.15 },
  move: { scrollbars: true, drag: true, wheel: false },
  grid: { spacing: 24, length: 2, colour: '#dde1ea', snap: false },
});

export function mainWorkspace(): Blockly.WorkspaceSvg {
  return main;
}

export function pathsWorkspace(): Blockly.WorkspaceSvg {
  return paths;
}

export function initWorkspaces(
  mainEl: HTMLElement,
  pathsEl: HTMLElement,
  callbacks: { onChange: () => void },
): void {
  main = Blockly.inject(mainEl, workspaceOptions(MAIN_TOOLBOX));
  paths = Blockly.inject(pathsEl, workspaceOptions(PATH_TOOLBOX));
  setPathWorkspace(paths);
  registerToolboxCallbacks(main);

  main.addChangeListener(Blockly.Events.disableOrphans);
  paths.addChangeListener(Blockly.Events.disableOrphans);

  const changed = (e: Blockly.Events.Abstract) => {
    if (e.isUiEvent || loading) return;
    refreshWarnings();
    callbacks.onChange();
  };
  main.addChangeListener(changed);
  paths.addChangeListener((e) => {
    if (loading) return;
    if (e.type === Blockly.Events.BLOCK_CHANGE) {
      const ce = e as Blockly.Events.BlockChange;
      const block = paths.getBlockById(ce.blockId ?? '');
      if (block?.type === 'sb_path_def' && ce.element === 'field' && ce.name === 'NAME') {
        renamePathReferences(String(ce.oldValue), String(ce.newValue));
      }
    }
    changed(e);
  });

  state.on((kind) => {
    if (kind === 'assets' || kind === 'level' || kind === 'currentLevel' || kind === 'levels') {
      refreshWarnings();
      // Rebuild flyouts so dropdown defaults match the project's assets.
      main.refreshToolboxSelection();
    }
  });
}

function renamePathReferences(oldName: string, newName: string): void {
  if (!oldName || oldName === newName) return;
  // Only rename if no other path still uses the old name.
  if (pathNames().includes(oldName)) return;
  Blockly.Events.setGroup(true);
  for (const block of main.getBlocksByType('sb_set_path', false)) {
    if (block.getFieldValue('PATH') === oldName) block.setFieldValue(newName, 'PATH');
  }
  Blockly.Events.setGroup(false);
}

/** Warns about grid locations outside the current level and references to missing paths. */
export function refreshWarnings(): void {
  if (!main) return;
  const level = state.level;
  const names = new Set(pathNames());
  for (const block of main.getAllBlocks(false)) {
    if (block.isInFlyout) continue;
    let warning: string | null = null;
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        if (field instanceof FieldGridLocation && !field.isInLevel()) {
          const [x, y] = field.coords;
          warning = `(${x}, ${y}) is outside “${level.name}”, which is ${level.cols}×${level.rows}. Nothing will be created or moved there.`;
        }
      }
    }
    if (block.type === 'sb_set_path' && !names.has(block.getFieldValue('PATH'))) {
      warning = `There is no path named “${block.getFieldValue('PATH')}”. Open the path editor to create it.`;
    }
    if (block.type === 'sb_set_path' || block.type === 'sb_create_at' || block.type === 'sb_move_to') {
      block.setWarningText(warning, 'sb_check');
    }
  }
}

export function loadWorkspaces(project: Project): void {
  loading = true;
  try {
    // Paths first: path dropdowns on the main workspace list names from the paths workspace.
    Blockly.serialization.workspaces.load(project.paths ?? {}, paths);
    Blockly.serialization.workspaces.load(project.main ?? {}, main);
  } finally {
    loading = false;
  }
  tidyIfOverlapping(paths);
  tidyIfOverlapping(main);
  main.clearUndo();
  paths.clearUndo();
  refreshWarnings();
}

/**
 * Lays top-level blocks out in rows if any of them overlap (e.g. a project saved with another renderer).
 * Workspaces whose blocks are already apart are left exactly as the user arranged them.
 */
function tidyIfOverlapping(ws: Blockly.WorkspaceSvg): void {
  const blocks = ws.getTopBlocks(true);
  const rects = blocks.map((b) => b.getBoundingRectangle());
  const overlap = rects.some((a, i) =>
    rects.some((b, j) => j > i && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom),
  );
  if (!overlap) return;
  const gap = 40;
  const maxWidth = Math.max(900, ws.getMetrics().viewWidth / ws.scale);
  let x = gap;
  let y = gap;
  let rowHeight = 0;
  blocks.forEach((block, i) => {
    const w = rects[i].right - rects[i].left;
    const h = rects[i].bottom - rects[i].top;
    if (x > gap && x + w > maxWidth) {
      x = gap;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const pos = block.getRelativeToSurfaceXY();
    block.moveBy(x - pos.x, y - pos.y);
    x += w + gap;
    rowHeight = Math.max(rowHeight, h);
  });
}

export function saveWorkspaces(): { main: object; paths: object } {
  return {
    main: Blockly.serialization.workspaces.save(main),
    paths: Blockly.serialization.workspaces.save(paths),
  };
}

export function compileProject(project: Project): CompiledProgram {
  const levels = structuredClone(project.levels);
  return {
    levels,
    levelSetup: levels.map(levelSetupCode),
    main: javascriptGenerator.workspaceToCode(main),
    paths: compilePaths(paths),
  };
}

export function resizeWorkspaces(): void {
  if (main) Blockly.svgResize(main);
  if (paths) Blockly.svgResize(paths);
}
