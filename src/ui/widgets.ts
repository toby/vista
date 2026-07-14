/**
 * Reusable retro UI widgets. Each control exposes `set()` to update its display
 * without firing its change handler, so the store can drive the widgets
 * (e.g. live camera values while dragging) without feedback loops.
 */

export interface Control<T> {
  readonly el: HTMLElement;
  set(value: T): void;
}

function div(className: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = className;
  return d;
}

function round(v: number, dp = 2): number {
  const m = 10 ** dp;
  return Math.round(v * m) / m;
}

export interface SliderOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onInput: (v: number) => void;
}

export function slider(o: SliderOptions): Control<number> {
  const row = div('vp-row');
  const label = div('vp-label');
  label.textContent = o.label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(o.min);
  input.max = String(o.max);
  input.step = String(o.step);
  const readout = div('vp-readout');
  const fmt = o.format ?? ((v: number): string => String(round(v)));
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    readout.textContent = fmt(v);
    o.onInput(v);
  });
  row.append(label, input, readout);
  return {
    el: row,
    set(v: number): void {
      input.value = String(v);
      readout.textContent = fmt(v);
    },
  };
}

export interface NumberFieldOptions {
  label: string;
  step?: number;
  onInput: (v: number) => void;
}

export function numberField(o: NumberFieldOptions): Control<number> {
  const row = div('vp-row');
  const label = div('vp-label');
  label.textContent = o.label;
  const input = document.createElement('input');
  input.type = 'number';
  if (o.step !== undefined) input.step = String(o.step);
  input.addEventListener('change', () => {
    const v = parseFloat(input.value);
    if (Number.isFinite(v)) o.onInput(v);
  });
  row.append(label, input);
  return {
    el: row,
    set(v: number): void {
      if (document.activeElement !== input) input.value = String(round(v, 2));
    },
  };
}

export interface ColorFieldOptions {
  label: string;
  onInput: (v: string) => void;
}

export function colorField(o: ColorFieldOptions): Control<string> {
  const row = div('vp-row');
  const label = div('vp-label');
  label.textContent = o.label;
  const input = document.createElement('input');
  input.type = 'color';
  input.addEventListener('input', () => o.onInput(input.value));
  row.append(label, input);
  return {
    el: row,
    set(v: string): void {
      input.value = v;
    },
  };
}

export interface SelectOptions {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onInput: (v: string) => void;
}

export function selectField(o: SelectOptions): Control<string> {
  const row = div('vp-row');
  const label = div('vp-label');
  label.textContent = o.label;
  const select = document.createElement('select');
  for (const opt of o.options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    select.append(el);
  }
  select.addEventListener('change', () => o.onInput(select.value));
  row.append(label, select);
  return {
    el: row,
    set(v: string): void {
      select.value = v;
    },
  };
}

export interface ButtonOptions {
  label: string;
  onClick: () => void;
  wide?: boolean;
  primary?: boolean;
}

export function button(o: ButtonOptions): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'vp-btn';
  if (o.wide) b.classList.add('vp-btn-wide');
  if (o.primary) b.classList.add('vp-primary');
  b.textContent = o.label;
  b.addEventListener('click', o.onClick);
  return b;
}

export interface Group {
  el: HTMLElement;
  body: HTMLElement;
}

export function group(title: string, collapsed = false): Group {
  const g = div('vp-group');
  if (collapsed) g.classList.add('collapsed');
  const header = div('vp-group-header');
  const name = document.createElement('span');
  name.textContent = title;
  const arrow = document.createElement('span');
  arrow.textContent = '\u25BC';
  header.append(name, arrow);
  const body = div('vp-group-body');
  header.addEventListener('click', () => {
    const isCollapsed = g.classList.toggle('collapsed');
    arrow.textContent = isCollapsed ? '\u25B6' : '\u25BC';
  });
  g.append(header, body);
  return { el: g, body };
}
