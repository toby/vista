/**
 * A tiny observable store. The UI patches params into it; the renderer and
 * other consumers subscribe to react to changes. Kept intentionally minimal —
 * params are small, so every update produces a fresh immutable snapshot.
 */

export type Listener<T> = (state: T) => void;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch as T;
  }
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    const patchValue = (patch as Record<string, unknown>)[key];
    const baseValue = out[key];
    out[key] =
      isPlainObject(baseValue) && isPlainObject(patchValue)
        ? deepMerge(baseValue, patchValue as DeepPartial<unknown>)
        : patchValue;
  }
  return out as T;
}

export class Store<T> {
  private state: T;
  private readonly listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this.state = initial;
  }

  /** Current immutable snapshot. */
  get(): T {
    return this.state;
  }

  /** Replace the entire state. */
  set(next: T): void {
    this.state = next;
    this.emit();
  }

  /** Deep-merge a partial patch (ideal for nested param edits from the UI). */
  patch(partial: DeepPartial<T>): void {
    this.state = deepMerge(this.state, partial);
    this.emit();
  }

  /** Mutate a structural clone via a callback, then commit it. */
  update(mutator: (draft: T) => void): void {
    const draft = structuredClone(this.state);
    mutator(draft);
    this.state = draft;
    this.emit();
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
