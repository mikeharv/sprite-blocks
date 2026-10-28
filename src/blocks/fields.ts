// Custom Blockly fields. Each is registered so blocks can reference it from standard JSON definitions.
import * as Blockly from 'blockly/core';
import { SOUNDS, getAsset, getSprite, thumbUrl } from '../assets';
import { SPRITE_CLASSES, parseCellKey } from '../model';
import { state } from '../state';
import { pathNames } from './path_registry';
import { playSound } from '../runtime/audio';

type MenuOption = Blockly.MenuOption;
const SEP = Blockly.FieldDropdown.SEPARATOR;

/** Dropdown whose options are computed from app state and which accepts any well-formed value on load. */
abstract class FieldDynamicDropdown extends Blockly.FieldDropdown {
  constructor(value?: string) {
    super(function (this: Blockly.FieldDropdown) {
      return (this as FieldDynamicDropdown).computeOptions();
    });
    if (value !== undefined) this.setValue(value);
  }

  protected abstract options(): MenuOption[];

  protected abstract isValid(value: string): boolean;

  protected labelFor(value: string): string {
    return value;
  }

  protected computeOptions(): MenuOption[] {
    const options = this.options();
    const current = this.getValue();
    const values = options.filter((o) => o !== SEP).map((o) => (o as [unknown, string])[1]);
    if (current && !values.includes(current)) options.push([this.labelFor(current), current]);
    return options.length ? options : [['(none)', '']];
  }

  protected override doClassValidation_(newValue?: string): string | null {
    if (typeof newValue !== 'string') return null;
    return this.isValid(newValue) ? newValue : null;
  }
}

function selectorLabel(value: string): string {
  if (value === 'any') return 'any sprite';
  const [kind, id] = value.split(':');
  if (kind === 'class') return SPRITE_CLASSES.find((c) => c.id === id)?.label ?? id;
  return getAsset(id)?.name ?? id;
}

/** Chooses a group of sprites: any sprite, all sprites of a class, or all sprites made from one asset. */
export class FieldSpriteSelector extends FieldDynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldSpriteSelector(options.value ?? 'class:player');
  }

  protected options(): MenuOption[] {
    const opts: MenuOption[] = [['any sprite', 'any'], SEP];
    for (const c of SPRITE_CLASSES) opts.push([c.label, 'class:' + c.id]);
    const assets = state.spriteAssetIds;
    if (assets.length) opts.push(SEP);
    for (const id of assets) opts.push([getAsset(id)!.name, 'asset:' + id]);
    return opts;
  }

  protected isValid(value: string): boolean {
    return value === 'any' || /^(class|asset):\w+$/.test(value);
  }

  protected labelFor(value: string): string {
    return selectorLabel(value);
  }
}

function imageOption(id: string): MenuOption {
  const asset = getAsset(id)!;
  return [{ src: thumbUrl(asset), width: 24, height: 24, alt: asset.name }, id];
}

/** Picks one sprite asset (costume) from the project, shown as images. */
export class FieldSpriteAsset extends FieldDynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldSpriteAsset(options.value ?? '');
  }

  protected options(): MenuOption[] {
    return state.spriteAssetIds.map(imageOption);
  }

  protected isValid(value: string): boolean {
    return value === '' || !!getSprite(value);
  }

  protected labelFor(value: string): string {
    return getAsset(value)?.name ?? value;
  }
}

/** Picks a background asset from the project. */
export class FieldBackground extends FieldDynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldBackground(options.value ?? '');
  }

  protected options(): MenuOption[] {
    return state.backgroundAssetIds.map(imageOption);
  }

  protected isValid(value: string): boolean {
    return value === '' || getAsset(value)?.kind === 'background';
  }
}

/** Picks a named path defined in the paths workspace. */
export class FieldPath extends FieldDynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldPath(options.value ?? '');
  }

  protected options(): MenuOption[] {
    return pathNames().map((n) => [n, n] as MenuOption);
  }

  protected isValid(): boolean {
    return true;
  }
}

/** Picks one of the built-in sounds and plays it as a preview when chosen. */
export class FieldSound extends FieldDynamicDropdown {
  static fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldSound(options.value ?? 'coin');
  }

  protected options(): MenuOption[] {
    return SOUNDS.map((s) => ['🔊 ' + s.name, s.id] as MenuOption);
  }

  protected isValid(value: string): boolean {
    return SOUNDS.some((s) => s.id === value);
  }

  protected override onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem): void {
    super.onItemSelected_(menu, menuItem);
    const id = this.getValue();
    if (id) playSound(id);
  }
}

/** Like FieldSound, with a “no sound” choice. */
export class FieldSoundOrNone extends FieldSound {
  static override fromJson(options: Blockly.FieldDropdownFromJsonConfig & { value?: string }) {
    return new FieldSoundOrNone(options.value ?? '');
  }

  protected override options(): MenuOption[] {
    return [['no sound', ''], ...super.options()];
  }

  protected override isValid(value: string): boolean {
    return value === '' || super.isValid(value);
  }
}

/**
 * A grid cell in the current level, stored as "x,y". Clicking opens a miniature of the level
 * being edited so a location can be picked visually.
 */
export class FieldGridLocation extends Blockly.Field<string> {
  override SERIALIZABLE = true;
  override EDITABLE = true;

  static fromJson(options: Blockly.FieldConfig & { value?: string }) {
    return new FieldGridLocation(options.value ?? '0,0');
  }

  constructor(value?: string) {
    super(value ?? '0,0');
  }

  protected override doClassValidation_(newValue?: unknown): string | null {
    if (typeof newValue !== 'string' || !/^-?\d+,-?\d+$/.test(newValue)) return null;
    return newValue;
  }

  get coords(): [number, number] {
    return parseCellKey(this.getValue() ?? '0,0');
  }

  isInLevel(): boolean {
    const [x, y] = this.coords;
    const level = state.level;
    return !!level && x >= 0 && y >= 0 && x < level.cols && y < level.rows;
  }

  protected override getText_(): string {
    const [x, y] = this.coords;
    return `📍 ${x}, ${y}`;
  }

  protected override showEditor_(): void {
    const level = state.level;
    const [cx, cy] = this.coords;
    const size = Math.max(10, Math.min(26, Math.floor(620 / level.cols)));
    const wrap = document.createElement('div');
    wrap.className = 'grid-picker';
    const title = document.createElement('div');
    title.className = 'grid-picker-title';
    title.textContent = `Pick a location in “${level.name}” (${level.cols}×${level.rows})`;
    const grid = document.createElement('div');
    grid.className = 'grid-picker-grid';
    grid.style.gridTemplateColumns = `repeat(${level.cols}, ${size}px)`;
    grid.style.gridAutoRows = `${size}px`;
    const hover = document.createElement('div');
    hover.className = 'grid-picker-status';
    hover.textContent = `Selected: ${cx}, ${cy}`;
    for (let y = 0; y < level.rows; y++) {
      for (let x = 0; x < level.cols; x++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'grid-picker-cell';
        const assetId = level.cells[x + ',' + y];
        const asset = getAsset(assetId);
        if (asset) cell.style.backgroundImage = `url(${thumbUrl(asset)})`;
        if (x === cx && y === cy) cell.classList.add('selected');
        cell.title = `${x}, ${y}${asset ? ' – ' + asset.name : ''}`;
        cell.addEventListener('mouseenter', () => (hover.textContent = cell.title));
        cell.addEventListener('click', () => {
          this.setValue(`${x},${y}`);
          Blockly.DropDownDiv.hideIfOwner(this as Blockly.Field, true);
        });
        grid.appendChild(cell);
      }
    }
    wrap.append(title, grid, hover);
    Blockly.DropDownDiv.getContentDiv().appendChild(wrap);
    Blockly.DropDownDiv.setColour('#ffffff', '#cccccc');
    Blockly.DropDownDiv.showPositionedByField(this as Blockly.Field);
  }
}

export function registerFields(): void {
  Blockly.fieldRegistry.register('field_sprite_selector', FieldSpriteSelector);
  Blockly.fieldRegistry.register('field_sprite_asset', FieldSpriteAsset);
  Blockly.fieldRegistry.register('field_background', FieldBackground);
  Blockly.fieldRegistry.register('field_path', FieldPath);
  Blockly.fieldRegistry.register('field_sound', FieldSound);
  Blockly.fieldRegistry.register('field_sound_or_none', FieldSoundOrNone);
  Blockly.fieldRegistry.register('field_grid_location', FieldGridLocation);
}

/** Default asset for new blocks: first project sprite of a class, then any project sprite, else none. */
export function defaultAsset(cls?: string): string {
  const ids = state.spriteAssetIds;
  return ids.find((id) => getSprite(id)?.cls === cls) ?? ids[0] ?? '';
}
