"use client"

import PianoApp from "@/components/Piano";
import FretlyGuitar from "@/components/Fretboard";
import { Card } from "@/components/ui/card"
import { useState } from "react";
import ScoreViewer from "@/components/ScoreViewer";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);

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
          <h1 className="text-4xl font-bold text-white mb-2">Music Studio</h1>
          <p className="text-slate-200">Interactive piano and guitar instruments with shared note highlighting</p>
        </div>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="space-y-8">
            <PianoApp onLoaded={() => setIsLoading(false)} />
            <div className="border-t border-slate-600"></div>
            <FretlyGuitar />
            <ScoreViewer />
          </div>
        </Card>
      </div>
    </main>
  );
}
