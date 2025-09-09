"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import * as Tone from "tone"
import { useChordNotesStore, useSelectedNoteStore, useStore } from "@/store/store"

const whiteKeys = [
  "C0",
  "D0",
  "E0",
  "F0",
  "G0",
  "A0",
  "B0",
  "C1",
  "D1",
  "E1",
  "F1",
  "G1",
  "A1",
  "B1",
  "C2",
  "D2",
  "E2",
  "F2",
  "G2",
  "A2",
  "B2",
  "C3",
  "D3",
  "E3",
  "F3",
  "G3",
  "A3",
  "B3",
  "C4",
  "D4",
  "E4",
  "F4",
  "G4",
  "A4",
  "B4",
  "C5",
  "D5",
  "E5",
  "F5",
  "G5",
  "A5",
  "B5",
  "C6",
  "D6",
  "E6",
]

// comment

const blackKeys = [
  "C#0",
  "D#0",
  "F#0",
  "G#0",
  "A#0",
  "C#1",
  "D#1",
  "F#1",
  "G#1",
  "A#1",
  "C#2",
  "D#2",
  "F#2",
  "G#2",
  "A#2",
  "C#3",
  "D#3",
  "F#3",
  "G#3",
  "A#3",
  "C#4",
  "D#4",
  "F#4",
  "G#4",
  "A#4",
  "C#5",
  "D#5",
  "F#5",
  "G#5",
  "A#5",
  "C#6",
  "D#6",
]

export default function PianoApp({ onLoaded }: { onLoaded?: () => void } = {}) {
  const { activeNotes, addActiveNote, removeActiveNote, clearActiveNotes } = useStore()
  const { chordNotes, setChordNotes } = useChordNotesStore()
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const { selectedNote, setSelectedNote } = useSelectedNoteStore()
  const synthRef = useRef<Tone.Sampler | null>(null)
  const [isAudioStarted, setIsAudioStarted] = useState(false)
  const [shouldPlayChord, setShouldPlayChord] = useState<Set<string> | null>(null)
  const [isSamplerLoaded, setIsSamplerLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  let error: number = 2; 

  useEffect(() => {
    synthRef.current = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        A7: "A7.mp3",
        C8: "C8.mp3",
      },
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => {
        setIsSamplerLoaded(true)
        setTimeout(() => {
          if (scrollRef.current) {
            const g2Index = whiteKeys.indexOf("G2")
            if (g2Index !== -1) {
              const keyWidth = 64
              const scrollLeft = g2Index * keyWidth - 100
              scrollRef.current.scrollLeft = scrollLeft
            }
          }
          if (onLoaded) onLoaded()
        }, 0)
      },
    }).toDestination()

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose()
      }
    }
  }, [])

  // Scroll to G2 after initial render
  useEffect(() => {
    if (scrollRef.current) {
      const g2Index = whiteKeys.indexOf("G2")
      if (g2Index !== -1) {
        const keyWidth = 64 // px, matches w-16
        const scrollLeft = g2Index * keyWidth - 100 // offset for visibility
        scrollRef.current.scrollLeft = scrollLeft
      }
    }
  }, []) // Only runs once after mount

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, []) // Removed selectedChordNotes dependency

  const startAudio = useCallback(async () => {
    if (!isAudioStarted) {
      await Tone.start()
      setIsAudioStarted(true)
    }
  }, [isAudioStarted])

  // Handle chord playback
  useEffect(() => {
    if (shouldPlayChord && synthRef.current) {
      const timeoutId = setTimeout(() => {
        // synthRef.current?.releaseAll() // <-- Remove this line
        shouldPlayChord.forEach((chordNote) => {
          if (synthRef.current && chordNote != "") {
            synthRef.current.triggerAttackRelease(chordNote, "2n")
          }
        })
        setShouldPlayChord(null)
      }, 50)

      return () => clearTimeout(timeoutId)
    }
  }, [shouldPlayChord])

  const playNote = useCallback(
    async (note: string) => {
      await startAudio()
      if (!isSamplerLoaded) return // Prevent playing before loaded

      if (synthRef.current?.loaded && !activeNotes.has(note)) {
        if (note != "") {
          synthRef.current.triggerAttack(note)
          addActiveNote(note)
        }
      } else if (synthRef.current) {
        synthRef.current.triggerAttack(note)
      }
    },
    [startAudio, activeNotes, addActiveNote, isSamplerLoaded],
  )

  const stopNote = useCallback(
    (note: string) => {
      if (synthRef.current && activeNotes.has(note)) {
        synthRef.current.triggerRelease(note)
        removeActiveNote(note)
      }
    },
    [activeNotes, removeActiveNote],
  )

  const handleMouseDown = useCallback(
    (note: string) => {
      if (!isSamplerLoaded) return

      if (isCtrlPressed) {
        // Compute new chord notes set
        const newSet = new Set(chordNotes)
        const wasInChord = newSet.has(note)
        if (wasInChord) {
          newSet.delete(note)
          if (activeNotes.has(note)) {
            removeActiveNote(note)
          }
        } else {
          newSet.add(note)
          if (selectedNote != "") {
            newSet.add(selectedNote)
          }
          addActiveNote(note)
        }

        setChordNotes(newSet)
        setShouldPlayChord(newSet)
        return
      } else if (chordNotes.has(note)) {
        const newSet = new Set(chordNotes)
        newSet.delete(note)
        setChordNotes(newSet)
        setShouldPlayChord(newSet)
        setTimeout(() => stopNote(note), 150)
      } else if (selectedNote != note && chordNotes) {
        stopNote(selectedNote)
        playNote(note)
        setSelectedNote(note)
        setChordNotes(new Set())
        clearActiveNotes()
      } else if (selectedNote === note) {
        setSelectedNote("")
        clearActiveNotes()
      }
      else {
        playNote(note)
        setSelectedNote(note)
      }
    },
    [
      playNote,
      isCtrlPressed,
      selectedNote,
      stopNote,
      activeNotes,
      chordNotes,
      isSamplerLoaded,
      addActiveNote,
      removeActiveNote,
      clearActiveNotes,
    ],
  )

  const whiteKeyWidth = 64; // width of a white key
  const blackKeyOffset = {
    "C#": 0.7,
    "D#": 1.7,
    "F#": 3.7,
    "G#": 4.7,
    "A#": 5.7,
  };
  
  const getBlackKeyPosition = (note: string, octave: number) => {
    const baseNote = note.includes("#") ? note : null;
    
    if (!baseNote) return 0;
    
    // Number of white keys before this octave
    const whiteKeysPerOctave = 7;
    const octaveOffset = octave * whiteKeysPerOctave * whiteKeyWidth;
  
    let keyOffset = blackKeyOffset[baseNote as keyof typeof blackKeyOffset] * (whiteKeyWidth / 1); // fine-tune if needed
    keyOffset = keyOffset - error
    error = error + 2
    if (note == "D#" && octave == 0) {
      error = error + 1
    }
    else if (note == "A#" && octave == 0) {
      error = error + 1
    }
    else if (note == "D#" && octave == 1) {
      error = error + 1
    }
    else if (note == "A#" && octave == 1) {
      error = error + 1
    }
    else if (note == "A#" && octave == 2) {
      error = error + 1
    }
    else if (note == "D#" && octave == 3) {
      error = error + 1
    }
    else if (note == "A#" && octave == 3) {
      error = error + 1
    }
    else if (note == "D#" && octave == 4) {
      error = error + 1
    }
    else if (note == "A#" && octave == 4) {
      error = error + 1
    }
    else if (note == "D#" && octave == 5) {
      error = error + 1
    }
    else if (note == "A#" && octave == 5) {
      error = error + 1
    }

    return octaveOffset + keyOffset;
  };

  const replayChord = useCallback(() => {
    if (!isSamplerLoaded) return
    // synthRef.current?.releaseAll() // <-- Remove this line if present
    chordNotes.forEach((note) => {
      if (synthRef.current) {
        if (note != "") {
          synthRef.current.triggerAttackRelease(note, "2n")
        }
      }
    })
  }, [chordNotes, isSamplerLoaded])

  return (
    <div className="w-full">
      {/* Show loading indicator if sampler not loaded */}
      {!isSamplerLoaded && <div className="text-center text-white mb-4">Loading piano samples...</div>}
      <div className="text-center mb-6">
        <p className="text-slate-200 text-sm">
          Click and hold keys to sustain notes • Hold Ctrl+click to select chord notes, release Ctrl to play • Scroll
          horizontally to see all keys (C0 to E6)
        </p>
      </div>

      <div className="overflow-x-auto scrollbar-custom" ref={scrollRef}>
        <div className="relative min-w-[2800px] h-40">
          <div className="flex">
            {whiteKeys.map((note, index) => (
<button
  key={note}
  onMouseDown={() => handleMouseDown(note)}
  className={`
    w-16 h-32 border-2 transition-all duration-75
    ${index === 0 ? "rounded-l-lg" : ""}
    ${index === whiteKeys.length - 1 ? "rounded-r-lg" : ""}
    ${
      activeNotes.has(note)
        ? "bg-blue-400 border-blue-300 shadow-lg shadow-blue-500/50"
        : "bg-white border-slate-600 hover:bg-slate-100 hover:border-slate-500"
    }
  `}
>
  <span
    className="text-xs text-slate-600 mt-auto block pb-4 font-medium relative"
    style={{ bottom: "calc(-50% + 10px)" }}
  >
    {note}
  </span>
</button>


            ))}
          </div>

          <div className="absolute top-0 left-0">
            {blackKeys.map((note) => {
              const octave = note.slice(-1)
              const baseNote = note.slice(0, -1)
              const position = getBlackKeyPosition(baseNote, Number(octave))

              return (
                <button
                  key={note}
                  className={`
                    absolute w-10 h-20 rounded-b-lg border-2 transition-all duration-75
                    ${
                      activeNotes.has(note)
                        ? "bg-purple-500 border-purple-400 shadow-lg shadow-purple-500/50"
                            : "bg-slate-900 border-slate-700 hover:bg-slate-800"
                    }
                  `}
                  style={{ left: `${position}px` }}
                  onMouseDown={() => handleMouseDown(note)}
                >
                  <span
                    className="text-xs text-white mt-auto block pb-2 font-medium"
                    style={{ position: "relative", bottom: "calc(-50% + 10px)" }}
                  >
                    {note}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-4">
        <Button
          variant="outline"
          onClick={replayChord}
          className="bg-blue-700 border-blue-600 text-white hover:bg-blue-600"
        >
          Replay Chord
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            chordNotes.forEach((note) => {
              if (synthRef.current) {
                synthRef.current.triggerRelease(note)
              }
            })
            setChordNotes(new Set())
            chordNotes.forEach((note) => removeActiveNote(note))
          }}
          className="bg-green-700 border-green-600 text-white hover:bg-green-600"
        >
          Clear Chord ({chordNotes.size} notes)
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (synthRef.current) {
              synthRef.current.releaseAll()
            }
          }}
          className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
        >
          Stop All Notes
        </Button>
      </div>

      <style jsx>{`
        .scrollbar-custom {
          scrollbar-width: thin;
          scrollbar-color: #475569 #1e293b;
        }
        
        .scrollbar-custom::-webkit-scrollbar {
          height: 8px;
        }
        
        .scrollbar-custom::-webkit-scrollbar-track {
          background: #1e293b;
          border-radius: 4px;
        }
        
        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 4px;
          border: 1px solid #334155;
        }
        
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  )
}