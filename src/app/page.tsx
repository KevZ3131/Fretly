import PianoApp from "@/components/Piano";
import FretlyGuitar from "@/components/Fretboard";
import { Card } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Music Studio</h1>
          <p className="text-slate-200">Interactive piano and guitar instruments with shared note highlighting</p>
        </div>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="space-y-8">
            <PianoApp />
            <div className="border-t border-slate-600"></div>
            <FretlyGuitar />
          </div>
        </Card>
      </div>
    </main>
  );
}
