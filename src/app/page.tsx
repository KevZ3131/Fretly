"use client"

import PianoApp from "@/components/Piano";
import FretlyGuitar from "@/components/Fretboard";
import TabRenderer from "@/components/TabRenderer";
import { Card } from "@/components/ui/card"
import { useState } from "react";
import ScoreViewer from "@/components/ScoreViewer";
import { useStore } from "@/store/store"

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  // holds selections made live on fretboard (user clicks)
  const [currentTabNotes, setCurrentTabNotes] = useState<{ string: number; fret: number }[]>([]);
  // holds the positions that correspond to the TabRenderer caret slot (when you navigate)
  const [selectedFromTab, setSelectedFromTab] = useState<{ string: number; fret: number }[]>([]);
  const store = useStore()

  return (
    <main className="min-h-screen bg-slate-900 p-4 relative">
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
            <span className="text-white text-xl font-semibold">Loading instruments...</span>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-[0_0_10px_#ff00ff] drop-shadow-[0_0_20px_#00ffff]">
            Fretly
          </h1>
        </div>
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="space-y-8">
            <PianoApp onLoaded={() => setIsLoading(false)} />
            <div className="border-t border-slate-600"></div>
            {/* pass both the setter to receive user selections and externalSelectedFrets to force selection on navigation */}
            <FretlyGuitar
              onSelectionChange={setCurrentTabNotes}
              externalSelectedFrets={selectedFromTab}
            />
            <TabRenderer
              hasScore={false}
              currentNotes={currentTabNotes}
              // When TabRenderer navigation changes, update selectedFromTab so fretboard highlights match the slot
              onNavigate={(idx, positions) => {
                // positions are in {str, fret} internal format; map to parent format {string, fret}
                const mapped = (positions || []).map(p => ({ string: p.str, fret: p.fret }))
                // immediately update both the current notes (for TabRenderer) and the external selected state (for fretboard)
                setCurrentTabNotes(mapped)
                setSelectedFromTab(mapped)
                // trigger playing via store if handler exists
                try {
                  store.playPositions?.(mapped)
                } catch (err) { /* ignore */ }
              }}
            />
            <ScoreViewer  />
          </div>
        </Card>
      </div>
    </main>
  );
}
