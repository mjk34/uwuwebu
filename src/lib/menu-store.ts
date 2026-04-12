"use client";

type Listener = () => void;

let open = false;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export const menuStore = {
  getOpen(): boolean {
    return open;
  },
  getServerOpen(): boolean {
    return false;
  },
  setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    emit();
  },
  toggle(): void {
    open = !open;
    emit();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
