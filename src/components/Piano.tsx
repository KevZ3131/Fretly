"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import * as Tone from "tone"
import { useStore } from "@/store/store"

const whiteKeys = [
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
]
const blackKeys = [
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
]

export default function PianoApp() {
  const { activeNotes, addActiveNote, removeActiveNote, clearActiveNotes } = useStore()
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)
  const [selectedChordNotes, setSelectedChordNotes] = useState<Set<string>>(new Set())
  const [selectedNote, setSelectedNote] = useState<string>("")
  const synthRef = useRef<Tone.Sampler | null>(null)
  const [isAudioStarted, setIsAudioStarted] = useState(false)
  const [shouldPlayChord, setShouldPlayChord] = useState<Set<string> | null>(null)

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
        console.log("[v0] Salamander piano samples loaded successfully")
      },
    }).toDestination()

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose()
      }
    }
  }, [])

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
  }, [selectedChordNotes])

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
        synthRef.current?.releaseAll()
        shouldPlayChord.forEach((chordNote) => {
          if (synthRef.current) {
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

      if (synthRef.current && !activeNotes.has(note)) {
        synthRef.current.triggerAttack(note)
        addActiveNote(note)
      }
    },
    [startAudio, activeNotes, addActiveNote],
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
      if (isCtrlPressed) {
        // Clear any previously selected regular note when starting chord selection
        if (selectedNote) {
          setSelectedNote("")
          clearActiveNotes()
        }
        
        setSelectedChordNotes((prev) => {
          const newSet = new Set(prev)
          const wasInChord = newSet.has(note)
          if (wasInChord) {
            newSet.delete(note)
            // If removing from chord, stop the note
            if (activeNotes.has(note)) {
              removeActiveNote(note)
            }
          } else {
            newSet.add(note)
            // If adding to chord, play the note
            addActiveNote(note)
          }
          
          // Trigger chord playback
          setShouldPlayChord(newSet)
          
          return newSet
        })
        return
      }
      else if (selectedChordNotes.has(note)) {
        setSelectedChordNotes((prev) => {
          const newSet = new Set(prev)
          newSet.delete(note)
          
          // Trigger chord playback
          setShouldPlayChord(newSet)
          
          return newSet
        })
        // Play the note for immediate visual feedback
        // Stop after a brief moment
        setTimeout(() => stopNote(note), 150)
      } 
      else if (selectedNote != note && selectedChordNotes) {
        stopNote(selectedNote)
        playNote(note)
        setSelectedNote(note)
        setSelectedChordNotes(new Set())
        clearActiveNotes()
      }
      else{
        playNote(note)
        setSelectedNote(note)
      }
    },
    [playNote, isCtrlPressed, selectedNote, stopNote, activeNotes, selectedChordNotes],
  )

  const getBlackKeyPosition = (note: string, octave: string) => {
    const baseNote = note.replace("#", "")
    const octaveNumber = Number.parseInt(octave)

    const positions = {
      C: 44,
      D: 108,
      F: 236,
      G: 300,
      A: 364,
    }

    let octaveOffset = (octaveNumber - 3) * 448 
    if (octaveNumber == 4) {
      octaveOffset = (octaveNumber - 3) * 448 - 3
    } 
    if (octaveNumber == 5) {
      octaveOffset = (octaveNumber - 3) * 448 - 6
    } 
    const basePosition = positions[baseNote as keyof typeof positions] || 0

    return basePosition + octaveOffset
  }

  const replayChord = useCallback(() => {
    selectedChordNotes.forEach((note) => {
      if (synthRef.current) {
        synthRef.current.triggerAttackRelease(note, "2n") // Changed from "8n" to "2n" for longer duration
      }
    })
  }, [selectedChordNotes])

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Virtual Piano</h1>
          <p className="text-slate-200">
            Click and hold keys to sustain notes • Hold Ctrl+click to select chord notes, release Ctrl to play • Scroll
            horizontally to see all keys
          </p>
        </div>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="overflow-x-auto">
            <div className="relative min-w-[1400px] h-64">
              <div className="flex">
                {whiteKeys.map((note, index) => (
                  <button
                    key={note}
                    className={`
                      w-16 h-48 border-2 border-slate-600 transition-all duration-75
                      ${
                        activeNotes.has(note)
                          ? "bg-blue-400 border-blue-300 shadow-lg shadow-blue-500/50" : "bg-white hover:bg-slate-100"
                      }
                      ${index === 0 ? "rounded-l-lg" : ""}
                      ${index === whiteKeys.length - 1 ? "rounded-r-lg" : ""}
                    `}
                    onMouseDown={() => handleMouseDown(note)}
                  >
                    <span className="text-xs text-slate-600 mt-auto block pb-4 font-medium" style={{ "position": "relative", "bottom": "calc(-50% + 10px)" }}>{note}</span>
                  </button>
                ))}
              </div>

              <div className="absolute top-0 left-0">
                {blackKeys.map((note) => {
                  const octave = note.slice(-1)
                  const baseNote = note.slice(0, -1)
                  const position = getBlackKeyPosition(baseNote, octave)

                  return (
                    <button
                      key={note}
                      className={`
                        absolute w-10 h-32 rounded-b-lg border-2 transition-all duration-75
                        ${
                          activeNotes.has(note)
                            ? "bg-purple-500 border-purple-400 shadow-lg shadow-purple-500/50"
                            : selectedChordNotes.has(note)
                              ? "bg-green-500 border-green-400 shadow-lg shadow-green-500/50"
                              : selectedNote === note
                                ? "bg-yellow-400 border-yellow-500 shadow-lg shadow-yellow-500/50"
                                : "bg-slate-900 border-slate-700 hover:bg-slate-800"
                        }
                      `}
                      style={{ left: `${position}px` }}
                      onMouseDown={() => handleMouseDown(note)}
                    >
                      <span className="text-xs text-white mt-auto block pb-2 font-medium" style={{ "position": "relative", "bottom": "calc(-50% + 10px)" }}>{note}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-4">
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
            {selectedChordNotes.size > 0 && (
              <>
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
                    selectedChordNotes.forEach((note) => {
                      if (synthRef.current) {
                        synthRef.current.triggerRelease(note)
                      }
                    })
                    setSelectedChordNotes(new Set)
                    selectedChordNotes.forEach((note) => removeActiveNote(note))
                  }}
                  className="bg-green-700 border-green-600 text-white hover:bg-green-600"
                >
                  Clear Chord ({selectedChordNotes.size} notes)
                </Button>
              </>
            )}
          </div>
        </Card>

        <div className="mt-6 text-center text-slate-300 text-sm">
          <p>
            Hold multiple keys simultaneously for chords • Hold Ctrl+click to select chord notes, release Ctrl to play •
            Release or move mouse away to stop individual notes
          </p>
        </div>
      </div>
    </div>
  )
}
