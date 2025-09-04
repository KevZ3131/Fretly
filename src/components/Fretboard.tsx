import React, { useRef, useState } from "react";

// FretlyGuitar.tsx
// Single-file React component (Tailwind classes) that renders a playable 6-string guitar fretboard.
// Features:
// - 6 strings (standard tuning E A D G B E)
// - 0..12 frets (open string + 12 frets)
// - fretlines, string lines
// - dot inlays at frets 3,5,7,9,12 (double dots at 12)
// - click any fret to play the corresponding note using the WebAudio API

const STANDARD_TUNING_MIDI = [64, 59, 55, 50, 45, 40]; // E4, B3, G3, D3, A2, E2 (string 1 -> 6 top to bottom)
const FRETS = 12;
const DOT_FRETS = [3, 5, 7, 9, 12];

function midiToFrequency(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export default function FretlyGuitar() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [active, setActive] = useState<{ s: number; f: number } | null>(null);

  function ensureAudio() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }

  function playNote(midi: number) {
    const ctx = ensureAudio();
    const now = ctx.currentTime;

    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.value = midiToFrequency(midi);

    // simple pluck envelope
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.8, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

    o.connect(g);
    g.connect(ctx.destination);

    o.start(now);
    o.stop(now + 2);
  }

  function onFretClick(stringIndex: number, fret: number) {
    const stringMidi = STANDARD_TUNING_MIDI[stringIndex];
    const midi = stringMidi + fret;
    setActive({ s: stringIndex, f: fret });
    playNote(midi);
    // clear highlight after short time
    setTimeout(() => setActive(null), 300);
  }

  const columns = FRETS + 1;
  const strings = 6;

  // String thickness (approx typical gauges, top = thin, bottom = thick)
  const STRING_THICKNESSES = [1, 1.5, 2, 2.5, 3, 4];

  return (
    <div className="p-6 flex flex-col items-center gap-4">
      <h2 className="text-2xl font-semibold">Fretly — Playable Guitar Fretboard</h2>

      <div className="relative bg-[#2b2b2b] rounded-2xl shadow-lg p-4" style={{ width: '960px' }}>
        {/* fretboard area */}
        <div className="relative bg-gradient-to-b from-[#4a3f34] to-[#3b2f24] rounded-lg overflow-hidden" style={{ height: 260 }}>
          {/* fretlines (vertical) */}
          <div className="absolute inset-0">
            {Array.from({ length: columns + 1 }).map((_, ci) => {
              const left = (ci / columns) * 100;
              return (
                <div
                  key={`fretline-${ci}`}
                  className={"absolute top-0 bottom-0 " + (ci === 0 ? "bg-black" : "bg-[#bfb39b]")}
                  style={{ left: `${left}%`, width: ci === 0 ? 6 : 2, transform: "translateX(-50%)" }}
                />
              );
            })}
          </div>

          {/* strings and fret cells */}
          <div className="absolute inset-0 flex flex-col justify-between py-6 px-2">
            {Array.from({ length: strings }).map((_, si) => {
              const thickness = STRING_THICKNESSES[si];
              return (
                <div key={`string-row-${si}`} className="relative flex items-center" style={{ height: `${100 / strings}%` }}>
                  {/* string line */}
                  <div className="absolute left-0 right-0 flex items-center" style={{ top: '50%' }}>
                    <div className="w-full border-t" style={{ borderTop: `${thickness}px solid #ddd` }} />
                  </div>

                  {/* fret cells */}
                  <div className="relative w-full flex">
                    {Array.from({ length: columns }).map((__, fi) => {
                      const isActive = active && active.s === si && active.f === fi;
                      // Place cell between two fretlines
                      return (
                        <button
                          key={`cell-${si}-${fi}`}
                          onClick={() => onFretClick(si, fi)}
                          className={`flex-1 h-12 lg:h-14 transition-all focus:outline-none ${isActive ? 'bg-yellow-300/50' : 'bg-transparent'}`}
                          style={{ marginLeft: '-1px', marginRight: '-1px' }}
                          title={`String ${si + 1} — Fret ${fi}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* fret numbers below the board */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-between px-2 text-xs text-[#f0efd7]">
            {Array.from({ length: columns }).map((_, fi) => (
              <div key={`fnum-${fi}`} className="flex-1 text-center">
                {fi}
              </div>
            ))}
          </div>

          {/* dot inlays overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {DOT_FRETS.map((fret) => {
              const start = (fret / columns) * 100;
              const next = ((fret + 1) / columns) * 100;
              const left = (start + next) / 2;

              const isDouble = fret === 12;

              const dotElements = isDouble
                ? [
                    { top: '33%' }, // between 4th & 5th
                    { top: '67%' }, // between 2nd & 3rd
                  ]
                : [{ top: '50%' }];

              return (
                <div key={`dot-${fret}`} style={{ left: `${left}%` }} className="absolute transform -translate-x-1/2 w-0 h-full flex items-center justify-center">
                  {dotElements.map((d, i) => (
                    <div
                      key={i}
                      style={{ top: d.top }}
                      className="absolute -translate-y-1/2 w-3 h-3 rounded-full bg-[#f3f1e7] shadow"
                    />
                  ))}
                </div>
              );
            })}
          </div>

        </div>

        {/* legend + instructions */}
        <div className="mt-3 text-sm text-[#efeae0]">
          Click any fret (or open string) to play the note. Open string = fret 0. Standard tuning: high e - B - G - D - A - low E (top to bottom).
        </div>
      </div>
    </div>
  );
}
