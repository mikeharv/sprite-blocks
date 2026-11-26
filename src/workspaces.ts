// Creates the main and paths Blockly workspaces and keeps them in sync with each other and the levels.
import * as Blockly from 'blockly/core';
import { isTablet } from './ui/device';
import { javascriptGenerator } from 'blockly/javascript';
import { FieldGridLocation, FieldLevel, FieldPath, FieldSound, FieldSpriteAsset } from './blocks/fields';
import { getAsset, getSound } from './assets';
import { compilePaths, pathGenerator } from './blocks/path_blocks';
import { pathNames, setPathWorkspace } from './blocks/path_registry';
import { MAIN_TOOLBOX, pathToolbox, registerToolboxCallbacks, theme } from './blocks/toolbox';
import { levelSetupCode } from './compile';
import type { CompiledProgram } from './runtime/engine';
import type { Project } from './model';
import { state } from './state';

let main: Blockly.WorkspaceSvg;
let paths: Blockly.WorkspaceSvg;
let loading = false;

type ToolboxProvider = (ws: Blockly.WorkspaceSvg) => Blockly.utils.toolbox.ToolboxDefinition;
/** Where each workspace's toolbox comes from: the full toolboxes, or a tutorial step's cut-down flyouts. */
let mainToolbox: ToolboxProvider = () => MAIN_TOOLBOX;
let pathsToolbox: ToolboxProvider = () => pathToolbox();

/** Uses these toolboxes from now on (both must keep the same kind as at start: categories or a flyout). */
export function setToolboxes(mainProvider: ToolboxProvider, pathsProvider: ToolboxProvider): void {
  mainToolbox = mainProvider;
  pathsToolbox = pathsProvider;
  if (main) refreshToolboxes();
}

/** Rebuilds the toolboxes, so dropdown defaults and path names match the project. */
export function refreshToolboxes(): void {
  refreshMainToolbox();
  paths.updateToolbox(pathsToolbox(paths));
}

function refreshMainToolbox(): void {
  if (main.getToolbox()) main.refreshToolboxSelection();
  else main.updateToolbox(mainToolbox(main));
}

/** Narrow windows and tablets start a little zoomed out, so more blocks (and the block list) fit. */
const defaultScale = () => (isTablet() || window.innerWidth < 1200 ? 0.72 : 0.9);

const workspaceOptions = (toolbox: Blockly.utils.toolbox.ToolboxDefinition): Blockly.BlocklyOptions => ({
  toolbox,
  theme,
  renderer: 'thrasos',
  trashcan: true,
  sounds: false,
  zoom: { controls: true, wheel: true, startScale: defaultScale(), maxScale: 2, minScale: 0.3, scaleSpeed: 1.15 },
  move: { scrollbars: true, drag: true, wheel: false },
  grid: { spacing: 24, length: 2, colour: '#dde1ea', snap: false },
});

export function mainWorkspace(): Blockly.WorkspaceSvg {
  return main;
}

export function pathsWorkspace(): Blockly.WorkspaceSvg {
  return paths;
}

/**
 * Creates both workspaces. With `toolboxes` (tutorial steps), each workspace gets a plain flyout from its
 * provider; otherwise the full categorized toolboxes. Blockly fixes the kind of toolbox when a workspace is
 * created, so it can't switch between the two afterwards.
 */
export function initWorkspaces(
  mainEl: HTMLElement,
  pathsEl: HTMLElement,
  callbacks: { onChange: () => void },
  toolboxes?: { main: ToolboxProvider; paths: ToolboxProvider },
): void {
  const flyout = { kind: 'flyoutToolbox', contents: [] } as Blockly.utils.toolbox.ToolboxDefinition;
  main = Blockly.inject(mainEl, workspaceOptions(toolboxes ? flyout : MAIN_TOOLBOX));
  registerToolboxCallbacks(main);
  paths = Blockly.inject(pathsEl, workspaceOptions(toolboxes ? flyout : pathToolbox()));
  setPathWorkspace(paths);
  // The flyouts are filled once a project is open (their dropdown defaults come from it).
  if (toolboxes) {
    mainToolbox = toolboxes.main;
    pathsToolbox = toolboxes.paths;
  }

  // Resizing across the narrow-window width moves the zoom along, unless the learner has zoomed themselves.
  let lastScale = defaultScale();
  window.addEventListener('resize', () => {
    const next = defaultScale();
    if (next === lastScale) return;
    for (const ws of [main, paths]) if (Math.abs(ws.scale - lastScale) < 0.001) ws.setScale(next);
    lastScale = next;
  });

  main.addChangeListener(Blockly.Events.disableOrphans);
  paths.addChangeListener(Blockly.Events.disableOrphans);

  const changed = (e: Blockly.Events.Abstract) => {
    if (e.isUiEvent || loading) return;
    refreshWarnings();
    callbacks.onChange();
  };
  paths.addChangeListener((e) => {
    // Path names appear in main-workspace dropdowns: keep the flyout in step.
    if (!e.isUiEvent && !loading) refreshMainToolbox();
  });
  main.addChangeListener(changed);
  // Tutorial flyouts list the variable blocks for the variables that exist: keep them in step.
  const VARIABLE_EVENTS: string[] = [Blockly.Events.VAR_CREATE, Blockly.Events.VAR_DELETE, Blockly.Events.VAR_RENAME];
  if (toolboxes) {
    main.addChangeListener((e) => {
      if (!loading && VARIABLE_EVENTS.includes(e.type)) main.updateToolbox(mainToolbox(main));
    });
    paths.addChangeListener((e) => {
      if (!loading && VARIABLE_EVENTS.includes(e.type)) paths.updateToolbox(pathsToolbox(paths));
    });
  }
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
      // Level names show in "when level … starts" blocks: redraw them after a rename or reorder.
      if (kind === 'levels') {
        for (const block of main.getBlocksByType('sb_when_level_named_starts', false)) {
          block.getField('LEVEL')?.forceRerender();
        }
      }
      refreshWarnings();
      // Rebuild flyouts so dropdown defaults match the project's assets.
      refreshToolboxes();
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

/** Warning text broken onto lines of about 50 characters, so the bubble fits on screen. */
export function wrapWarning(text: string): string {
  return Blockly.utils.string.wrap(text, 50);
}

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
      } else if (field instanceof FieldLevel && !field.exists()) {
        out.push('That level has been deleted. Pick another level.');
      } else if (field instanceof FieldPath && !names.has(field.getValue() ?? '')) {
        out.push(`There is no path named “${field.getValue()}”. Create it on the Paths tab.`);
      }
    }
  }
  // Restarting while the level starts would restart it forever: the game looks frozen.
  const root = block.getRootBlock().type;
  if (block.type === 'sb_restart_level' && (root === 'sb_when_level_starts' || root === 'sb_when_level_named_starts')) {
    out.push(
      'This restarts the level every time it starts, so the level never gets going and the game looks stuck. ' +
        'Put “restart level” in another event, like “when the player touches …”.',
    );
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
        block.setWarningText(text && wrapWarning(text), 'sb_check');
      }
    }
  }
}

/** A serialized block, as far as upgrading old saves needs. */
interface SavedBlock {
  type?: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: SavedBlock; shadow?: SavedBlock }>;
  next?: { block?: SavedBlock };
}

/**
 * Upgrades blocks saved by older versions: "set … path speed" used to take a number and now picks a speed
 * (the nearest of slow, normal, fast and very fast).
 */
function upgradeBlock(b: SavedBlock | undefined): void {
  if (!b) return;
  if (b.type === 'sb_set_speed' && b.inputs?.SPEED) {
    const value = b.inputs.SPEED.block ?? b.inputs.SPEED.shadow;
    const n = Number(value?.type === 'math_number' ? value.fields?.NUM : 2) || 2;
    const nearest = [1, 2, 4, 8].reduce((best, s) => (Math.abs(Math.log2(s / n)) < Math.abs(Math.log2(best / n)) ? s : best));
    b.fields = { ...b.fields, SPEED: String(nearest) };
    delete b.inputs.SPEED;
  }
  for (const input of Object.values(b.inputs ?? {})) {
    upgradeBlock(input.block);
    upgradeBlock(input.shadow);
  }
  upgradeBlock(b.next?.block);
}

function upgradeWorkspace<T>(saved: T): T {
  const blocks = (saved as { blocks?: { blocks?: SavedBlock[] } })?.blocks?.blocks;
  blocks?.forEach(upgradeBlock);
  return saved;
}

export function loadWorkspaces(project: Project): void {
  loading = true;
  try {
    // Paths first: path dropdowns on the main workspace list names from the paths workspace.
    Blockly.serialization.workspaces.load(project.paths ?? {}, paths);
    Blockly.serialization.workspaces.load(upgradeWorkspace(project.main ?? {}), main);
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

/**
 * Compiles the project. With `trackBlocks` (tutorial runs), every block reports its id just before it runs, so
 * tutorial checks can ask whether a kind of block actually ran.
 */
export function compileProject(project: Project, trackBlocks = false): CompiledProgram {
  const levels = structuredClone(project.levels);
  return {
    levels,
    levelSetup: levels.map(levelSetupCode),
    main: exposeVariables(withRanReports(javascriptGenerator, main, '$g.ran(%1);\n', trackBlocks, () => javascriptGenerator.workspaceToCode(main))),
    paths: withRanReports(pathGenerator, paths, '$p.ran(%1);\n', trackBlocks, () => compilePaths(paths)),
  };
}

/**
 * Generates code with Blockly's statement prefix set to report each block as it runs. Top blocks (events, paths
 * and functions) are left out: their code runs when the program is set up, not when the event happens.
 */
function withRanReports(
  generator: { STATEMENT_PREFIX: string | null },
  ws: Blockly.Workspace,
  prefix: string,
  on: boolean,
  generate: () => string,
): string {
  if (!on) return generate();
  const tops = ws.getTopBlocks(false).map((b) => [b, b.suppressPrefixSuffix] as const);
  tops.forEach(([b]) => (b.suppressPrefixSuffix = true));
  generator.STATEMENT_PREFIX = prefix;
  try {
    return generate();
  } finally {
    generator.STATEMENT_PREFIX = null;
    tops.forEach(([b, before]) => (b.suppressPrefixSuffix = before));
  }
}

/**
 * Adds a line that hands the engine a reader for the program's variables (Blockly declares them in one `var`
 * line at the top), so tutorial checks can look at them.
 */
function exposeVariables(code: string): string {
  const names = /^var ([\w$, ]+);$/m.exec(code)?.[1].split(',').map((n) => n.trim()).filter(Boolean) ?? [];
  if (!names.length) return code;
  return code + `$g.exposeVariables(function () {\n  return { ${names.map((n) => `${n}: ${n}`).join(', ')} };\n});\n`;
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
