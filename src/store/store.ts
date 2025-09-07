import { create } from "zustand";

interface StoreState {
  activeNotes: Set<string>;
  setActiveNotes: (notes: Set<string>) => void;
  addActiveNote: (note: string) => void;
  removeActiveNote: (note: string) => void;
  clearActiveNotes: () => void;
  playNote: (note: string) => void;
}

export const useStore = create<StoreState>((set) => ({
  activeNotes: new Set<string>(),
  setActiveNotes: (notes) => set({ activeNotes: notes }),
  addActiveNote: (note) => set((state) => ({
    activeNotes: new Set([...state.activeNotes, note])
  })),
  removeActiveNote: (note) => set((state) => {
    const newSet = new Set(state.activeNotes);
    newSet.delete(note);
    return { activeNotes: newSet };
  }),
  clearActiveNotes: () => set({ activeNotes: new Set<string>() }),
  playNote: (note) => {
    set((state) => ({
      activeNotes: new Set([...state.activeNotes, note])
    }))
    // Note will be played by Piano component through activeNotes subscription
  },
}));