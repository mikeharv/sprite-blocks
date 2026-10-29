// Creates the main and paths Blockly workspaces and keeps them in sync with each other and the levels.
import * as Blockly from 'blockly/core';
import { javascriptGenerator } from 'blockly/javascript';
import { FieldGridLocation, FieldPath, FieldSound, FieldSpriteAsset } from './blocks/fields';
import { getAsset, getSound } from './assets';
import { compilePaths } from './blocks/path_blocks';
import { pathNames, setPathWorkspace } from './blocks/path_registry';
import { MAIN_TOOLBOX, pathToolbox, registerToolboxCallbacks, theme } from './blocks/toolbox';
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
  paths = Blockly.inject(pathsEl, workspaceOptions(pathToolbox()));
  setPathWorkspace(paths);
  registerToolboxCallbacks(main);

  main.addChangeListener(Blockly.Events.disableOrphans);
  paths.addChangeListener(Blockly.Events.disableOrphans);

  const changed = (e: Blockly.Events.Abstract) => {
    if (e.isUiEvent || loading) return;
    refreshWarnings();
    callbacks.onChange();
  };
  paths.addChangeListener((e) => {
    // Path names appear in main-workspace dropdowns: keep the flyout in step.
    if (!e.isUiEvent && !loading) main.refreshToolboxSelection();
  });
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
    if (kind === 'assets' || kind === 'sounds' || kind === 'level' || kind === 'currentLevel' || kind === 'levels') {
      refreshWarnings();
      // Rebuild flyouts so dropdown defaults match the project's assets.
      main.refreshToolboxSelection();
      paths.updateToolbox(pathToolbox());
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

/** Blocks that only do something in platformer levels. */
const PLATFORMER_ONLY = new Set(['sb_bounce', 'sb_set_gravity', 'sb_jump_height', 'sb_on_ground', 'sb_path_jump', 'sb_path_on_ground']);

/** Problems with one block's own fields, or null. */
function blockWarnings(block: Blockly.Block, names: Set<string>, platformer: boolean): string[] {
  const level = state.level;
  const out: string[] = [];
  for (const input of block.inputList) {
    for (const field of input.fieldRow) {
      if (field instanceof FieldGridLocation && !field.isInLevel()) {
        const [x, y] = field.coords;
        out.push(`(${x}, ${y}) is outside “${level.name}”, which is ${level.cols}×${level.rows}. Nothing will be created or moved there.`);
      } else if (field instanceof FieldSound && !field.isInProject()) {
        out.push(`The sound “${getSound(field.getValue())?.name}” isn’t in your project. Add it on the Sprites tab.`);
      } else if (field instanceof FieldSpriteAsset && !field.isInProject()) {
        out.push(`“${getAsset(field.getValue())?.name}” isn’t in your project. Add it on the Sprites tab.`);
      } else if (field instanceof FieldPath && !names.has(field.getValue() ?? '')) {
        out.push(`There is no path named “${field.getValue()}”. Create it on the Paths tab.`);
      }
    }
  }
  if (!platformer && PLATFORMER_ONLY.has(block.type)) {
    out.push('Every level is top-down, so this block does nothing. It only works in platformer levels.');
  }
  return out;
}

/**
 * Warns about grid locations outside the current level, sounds and sprites missing from the project,
 * missing paths, and platformer blocks in all-top-down games. Shadow blocks report on their parent.
 */
export function refreshWarnings(): void {
  if (!main || !paths) return;
  const names = new Set(pathNames());
  const platformer = state.project.levels.some((l) => l.mode === 'platformer');
  for (const ws of [main, paths]) {
    const found = new Map<Blockly.Block, string[]>();
    for (const block of ws.getAllBlocks(false)) {
      if (block.isInFlyout) continue;
      const warnings = blockWarnings(block, names, platformer);
      if (!warnings.length) continue;
      let target: Blockly.Block | null = block;
      while (target?.isShadow()) target = target.getParent();
      if (target) found.set(target, [...(found.get(target) ?? []), ...warnings]);
    }
    for (const block of ws.getAllBlocks(false)) {
      if (block.isInFlyout || block.isShadow()) continue;
      const text = found.get(block)?.join('\n\n') ?? null;
      if (text || block.hasIcon(Blockly.icons.IconType.WARNING)) {
        block.setWarningText(text, 'sb_check');
      }
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

/** Scrolls so the top-left of the blocks is just inside the visible area, beside the toolbox. */
export function scrollToBlocks(ws: Blockly.WorkspaceSvg): void {
  const box = ws.getBlocksBoundingBox();
  if (!ws.getTopBlocks(false).length) return;
  ws.scroll(-box.left * ws.scale + 24, -box.top * ws.scale + 24);
}

export function resizeWorkspaces(): void {
  if (main) Blockly.svgResize(main);
  if (paths) Blockly.svgResize(paths);
}
