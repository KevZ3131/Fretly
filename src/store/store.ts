import { create } from "zustand";

interface StoreState {
  activeNotes: Set<string>;
  setActiveNotes: (notes: Set<string>) => void;
  addActiveNote: (note: string) => void;
  removeActiveNote: (note: string) => void;
  clearActiveNotes: () => void;

  // score navigator callbacks (registered by ScoreViewer)
  scoreNext?: () => void;
  scorePrev?: () => void;
  setScoreNavigator: (next: (() => void) | undefined, prev: (() => void) | undefined) => void;

  // play tab positions callback (registered by Fretboard)
  playPositions?: (positions: { string: number; fret: number }[]) => void;
  setPlayPositions: (fn?: (positions: { string: number; fret: number }[]) => void) => void;
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

  // defaults for navigators / players
  scoreNext: undefined,
  scorePrev: undefined,
  setScoreNavigator: (next, prev) => set(() => ({ scoreNext: next, scorePrev: prev })),

  playPositions: undefined,
  setPlayPositions: (fn) => set(() => ({ playPositions: fn })),
}));