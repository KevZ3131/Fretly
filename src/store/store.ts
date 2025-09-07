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

  // tab navigator callbacks (registered by TabRenderer)
  tabNext?: () => void;
  tabPrev?: () => void;
  setTabNavigator: (next?: () => void, prev?: () => void) => void;

  // central navigation helpers that call both score and tab handlers
  navigateNext: () => void;
  navigatePrev: () => void;

  // play tab positions callback (registered by Fretboard)
  playPositions?: (positions: { string: number; fret: number }[]) => void;
  setPlayPositions: (fn?: (positions: { string: number; fret: number }[]) => void) => void;

  // clear tabs callback (registered by TabRenderer)
  clearTabs?: () => void;
  setClearTabs: (fn?: () => void) => void;

  // new: numeric signal for clearing tabs (avoid timing/race issues)
  clearTabsSignal: number;
  incrementClearTabs: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
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

  // tab navigator
  tabNext: undefined,
  tabPrev: undefined,
  setTabNavigator: (next, prev) => set(() => ({ tabNext: next, tabPrev: prev })),

  // central navigate that triggers both score and tab handlers (if present)
  navigateNext: () => {
    const s = get();
    try { s.scoreNext && s.scoreNext() } catch {}
    try { s.tabNext && s.tabNext() } catch {}
  },
  navigatePrev: () => {
    const s = get();
    try { s.scorePrev && s.scorePrev() } catch {}
    try { s.tabPrev && s.tabPrev() } catch {}
  },

  playPositions: undefined,
  setPlayPositions: (fn) => set(() => ({ playPositions: fn })),

  // clear tabs
  clearTabs: undefined,
  setClearTabs: (fn) => set(() => ({ clearTabs: fn })),

  // new: signal and incrementer
  clearTabsSignal: 0,
  incrementClearTabs: () => set((state) => ({ clearTabsSignal: state.clearTabsSignal + 1 })),
}));