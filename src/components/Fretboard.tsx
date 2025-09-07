'use client';

import React, { useRef, useState, useEffect } from "react";
import ReactDOM from 'react-dom'
import * as Tone from "tone"
import Chord from '@tombatossals/react-chords/lib/Chord'
import { useStore } from "@/store/store"
import { Button } from "./ui/button";

const STANDARD_TUNING_MIDI = [64, 59, 55, 50, 45, 40];
const FRETS = 24;
const DOT_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToFrequency(midi: number) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

type FretState = {
  highlighted?: boolean;
  selected?: boolean;
  voicing?: boolean;
  [key: string]: boolean | undefined; // extensible
};

export default function FretlyGuitar() {
    const { activeNotes } = useStore();
    const [fretboard, setFretboard] = useState<Map<number, FretState>[]>(
        () => Array.from({ length: 6 }, () => new Map())
    );
    const synthRef = useRef<Tone.Sampler | null>(null);
    const [isAudioStarted, setIsAudioStarted] = useState(false);
    const [selectedChordFrets, setSelectedChordFrets] = useState<{ stringIndex: number, fretIndex: number }[]>([]);
    const [showChordChart, setShowChordChart] = useState(true);

    useEffect(() => {
        synthRef.current = new Tone.Sampler({
            urls: {
                "E2": "/audio/guitar_note_samples/E2.mp3",
                "G2": "/audio/guitar_note_samples/G2.mp3",
                "A#2": "/audio/guitar_note_samples/A_sharp2.mp3",
                "C#3": "/audio/guitar_note_samples/C_sharp3.mp3",
                "E3": "/audio/guitar_note_samples/E3.mp3",
                "G3": "/audio/guitar_note_samples/G3.mp3",
                "A#3": "/audio/guitar_note_samples/A_sharp3.mp3",
                "C#4": "/audio/guitar_note_samples/C_sharp4.mp3",
                "E4": "/audio/guitar_note_samples/E4.mp3",
                "G4": "/audio/guitar_note_samples/G4.mp3",
                "A#4": "/audio/guitar_note_samples/A_sharp4.mp3",
                "C#5": "/audio/guitar_note_samples/C_sharp5.mp3",
                "E5": "/audio/guitar_note_samples/E5.mp3",
                "G5": "/audio/guitar_note_samples/G5.mp3",
                "A#5": "/audio/guitar_note_samples/A_sharp5.mp3",
                "C#6": "/audio/guitar_note_samples/C_sharp6.mp3",
            },
            onload: () => {
                console.log("Guitar samples loaded successfully")
            },
        }).toDestination()

        return () => {
            if (synthRef.current) {
                synthRef.current.dispose()
            }
            }
    }, [])

    function getMidiForStringFret(stringIndex: number, fretIndex: number): number {
        return STANDARD_TUNING_MIDI[stringIndex] + fretIndex;
    }

    function getNoteName(midi: number): string {
        const noteIndex = midi % 12;
        return NOTE_NAMES[noteIndex];
    }

    function playSelectedChord(currentFretboard: Map<number, FretState>[]) {
        if (!synthRef.current) return;
        const selectedNotes: { midi: number; stringIndex: number; fretIndex: number }[] = [];
        for (let si = 0; si < currentFretboard.length; si++) {
            for (const [fi, state] of currentFretboard[si].entries()) {
                if (state.selected) {
                    selectedNotes.push({ midi: getMidiForStringFret(si, fi), stringIndex: si, fretIndex: fi });
                }
            }
        }
        // Play all selected notes at once
        selectedNotes.forEach(({ midi }) => {
            const freq = midiToFrequency(midi);
            if (synthRef.current) {
                synthRef.current.triggerAttackRelease(freq, "1.2");
            }
        });
    }

    function updateFret(stringIndex: number, fretIndex: number, updates: Partial<FretState>) {
        setFretboard(prev => {
            const newBoard = [...prev];
            const newMap = new Map(newBoard[stringIndex]); // clone string's map

            // if selecting, clear other selected frets on this string
            if (updates.selected) {
                const fretState = newMap.get(fretIndex);
                if (fretState?.selected === true) {
                    const fretState = newMap.get(fretIndex) ?? {};
                    newMap.set(fretIndex, { ...fretState, ...updates, selected: false });
                    newBoard[stringIndex] = newMap;
                    // Update selectedChordFrets state
                    setSelectedChordFrets(prev =>
                        prev.filter(f => !(f.stringIndex === stringIndex && f.fretIndex === fretIndex))
                    );
                    setTimeout(() => {
                        playSelectedChord(newBoard);
                    }, 0);
                    return newBoard;
                }
                for (const [f, state] of newMap.entries()) {
                    if (state.selected) {
                        newMap.set(f, { ...state, selected: false });
                    }
                }
            }

            const oldState = newMap.get(fretIndex) ?? {};
            newMap.set(fretIndex, { ...oldState, ...updates });
            newBoard[stringIndex] = newMap;

            // Update selectedChordFrets state
            if (updates.selected) {
                setSelectedChordFrets(prev => {
                    // Remove any previous selection for this string
                    const filtered = prev.filter(f => f.stringIndex !== stringIndex);
                    return [...filtered, { stringIndex, fretIndex }];
                });
            }

            // Play chord if selecting
            if (updates.selected) {
                setTimeout(() => {
                    playSelectedChord(newBoard);
                }, 0);
            }

            return newBoard;
        });
    }

    // Replay chord
    function replayChord() {
        if (!synthRef.current) return;
        selectedChordFrets.forEach(({ stringIndex, fretIndex }) => {
            const midi = getMidiForStringFret(stringIndex, fretIndex);
            const freq = midiToFrequency(midi);
            synthRef.current!.triggerAttackRelease(freq, "1.2");
        });
    }

    // Clear chord
    function clearChord() {
        setFretboard(prev => {
            const newBoard = prev.map((stringMap, si) => {
                const newMap = new Map(stringMap);
                for (const [fi, state] of newMap.entries()) {
                    if (state.selected) {
                        newMap.set(fi, { ...state, selected: false });
                    }
                }
                return newMap;
            });
            return newBoard;
        });
        setSelectedChordFrets([]);
    }

    function isSelected(stringIndex: number, fretIndex: number): boolean {
        return fretboard[stringIndex].get(fretIndex)?.selected === true;
    }

    function isHighlighted(stringIndex: number, fretIndex: number): boolean {
        return fretboard[stringIndex].get(fretIndex)?.highlighted === true;
    }

    function isVoicing(stringIndex: number, fretIndex: number): boolean {
        return fretboard[stringIndex].get(fretIndex)?.voicing === true;
    }

    function hasAnyState(stringIndex: number, fretIndex: number): boolean {
        const state = fretboard[stringIndex].get(fretIndex);
        if (!state) {
            return false; // nothing stored at all
        }
        return Object.values(state).some(Boolean);
    }

    function onFretClick(stringIndex: number, fret: number) {
        updateFret(stringIndex, fret, { selected: true });
    }

    const strings = 6;
    const STRING_THICKNESSES = [1.5, 2, 2.5, 3, 3.5, 4];

    useEffect(() => {
        // Get note names from activeNotes (ignore octave)
        const activeNoteNames = Array.from(activeNotes).map(n => n.replace(/[0-9]+$/, ""));
        setFretboard(prev => {
            // For each string/fret, set voicing if note name matches
            return prev.map((stringMap, si) => {
                const newMap = new Map(stringMap);
                for (let fi = 0; fi <= FRETS; fi++) {
                    const midi = getMidiForStringFret(si, fi);
                    const noteName = getNoteName(midi);
                    if (activeNoteNames.includes(noteName)) {
                        const oldState = newMap.get(fi) ?? {};
                        newMap.set(fi, { ...oldState, voicing: true });
                    } else {
                        const oldState = newMap.get(fi);
                        if (oldState && oldState.voicing) {
                            // Remove voicing if not in activeNotes
                            const { voicing, ...rest } = oldState;
                            newMap.set(fi, rest);
                        }
                    }
                }
                return newMap;
            });
        });
    }, [activeNotes]);

    function getChordChartFromSelectedFrets(selectedFrets: { stringIndex: number, fretIndex: number }[]) {
        // Sort by stringIndex (low E = 0, high E = 5)
        const sorted = [...selectedFrets].sort((a, b) => a.stringIndex - b.stringIndex);
        // If no selected frets, show open strings
        if (sorted.length === 0) return { frets: [-1, -1, -1, -1, -1, -1], capo: false };
        // Build frets array: for each string, use selected fret or -1 (muted)
        const frets = [];
        for (let i = 5; i >= 0; i--) {
            const found = sorted.find(f => f.stringIndex === i);
            frets.push(found ? found.fretIndex : -1);
        }

        // Calculate min/max fret (excluding open/muted strings)
        const usedFrets = frets.filter(f => f > 0);
        const minFret = usedFrets.length > 0 ? Math.min(...usedFrets) : 0;
        const maxFret = usedFrets.length > 0 ? Math.max(...usedFrets) : 0;
        const fretRange = maxFret - minFret + 1;

        // If the range is too large, signal can't render
        if (fretRange > instrument.fretsOnChord - 1) {
            return { cantRender: true };
        }

        // Adjust frets relative to minFret
        for (let i = 0; i < frets.length; i++) {
            if (frets[i] >= 1) {
                frets[i] = frets[i] - minFret + 1;
            }
        }
        if (minFret > 1) {
            return {
                frets,
                capo: true,
                baseFret: minFret
            };
        }
        else {
            return {
                frets,
                capo: false
            };
        }
    }

    const instrument = {
        strings: 6,
        fretsOnChord: 5,
        name: 'Guitar',
        keys: [],
        tunings: {
            standard: ['E', 'A', 'D', 'G', 'B', 'E']
        }
    };
    const lite = false

    return (
        <div className="w-full">
            <div className="text-center mb-6">
                <p className="text-slate-200 text-sm">
                    Click frets to select chord notes • Notes highlight based on piano selection
                </p>
            </div>
            {/* Fretboard + chord chart side by side */}
            <div className="flex flex-row items-start gap-6">
                {/* Scrollable fretboard + numbers */}
                <div className="overflow-x-auto flex-1 scrollbar-custom">
                    <div
                        className="relative bg-gradient-to-b from-[#4a3f34] to-[#3b2f24] rounded-lg overflow-hidden"
                        style={{ height: 180, minWidth: "1075px", width: "100%" }}
                    >
                        {/* Fretlines */}
                        <div className="absolute inset-0">
                            {Array.from({ length: FRETS + 2 }).map((_, ci) => {
                                const left = (ci / (FRETS + 1)) * 100;
                                return (
                                    <div
                                        key={`fretline-${ci}`}
                                        className={"absolute top-0 bottom-0 " + (ci === 0 ? "bg-black" : "bg-[#bfb39b]")}
                                        style={{ left: `${left}%`, width: ci === 0 ? 6 : 2, transform: "translateX(-50%)" }}
                                    />
                                );
                            })}
                        </div>

                        {/* Strings and fret buttons */}
                        <div className="absolute inset-0 flex flex-col justify-between py-0 px-0">
                            {Array.from({ length: strings }).map((_, si) => {
                                const thickness = STRING_THICKNESSES[si];
                                return (
                                    <div key={`string-row-${si}`} className="relative flex items-center" style={{ height: `${100 / strings}%` }}>
                                        {/* String line spanning full width */}
                                        <div className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2">
                                            <div className="w-full" style={{ borderTop: `${thickness}px solid #ddd` }} />
                                        </div>
                                        {/* Fret buttons */}
                                        <div className="absolute left-0 right-0 top-0 bottom-0">
                                            {Array.from({ length: FRETS + 1 }).map((_, fi) => {
                                                const start = (fi / (FRETS + 1)) * 100;
                                                const end = ((fi + 1) / (FRETS + 1)) * 100;
                                                const width = end - start;
                                                const midi = getMidiForStringFret(si, fi);
                                                const noteName = getNoteName(midi);
                                                return (
                                                    <button
                                                        key={`cell-${si}-${fi}`}
                                                        onClick={() => onFretClick(si, fi)}
                                                        className="absolute h-full focus:outline-none focus:ring-0 bg-transparent group"
                                                        style={{
                                                            left: `${start}%`,
                                                            width: `${width}%`,
                                                            zIndex: 3,
                                                            top: "50%",
                                                            transform: "translateY(-50%)"
                                                        }}
                                                        title={`String ${si + 1} — Fret ${fi}`}
                                                        onMouseEnter={() => {updateFret(si, fi, { highlighted: true })}}
                                                        onMouseLeave={() => {updateFret(si, fi, { highlighted: false })}}
                                                    >
                                                        <div
                                                            className={`${hasAnyState(si, fi) ? "flex" : "hidden group-hover:flex"}`}
                                                            style={{
                                                                width: "1.8rem",
                                                                height: "1.8rem",
                                                                borderRadius: "100%",
                                                                borderWidth: `${1.5 + thickness / 4.0}px`,
                                                                borderColor: "#64748b",
                                                                backgroundColor: isSelected(si, fi)
                                                                    ? "#3b82f6"
                                                                    : isHighlighted(si, fi)
                                                                    ? "#22c55e"
                                                                    : isVoicing(si, fi)
                                                                    ? "#f59e0b"
                                                                    : "#22c55e",
                                                                opacity: isSelected(si, fi)
                                                                    ? 1
                                                                    : (isHighlighted(si, fi) || isVoicing(si, fi))
                                                                    ? 0.85
                                                                    : 0.3,
                                                                marginLeft: "auto",
                                                                marginRight: "auto",
                                                                boxShadow: isSelected(si, fi)
                                                                    ? "0 0 6px 1px #3b82f6"
                                                                    : isHighlighted(si, fi)
                                                                    ? "0 0 4px 0.5px #22c55e"
                                                                    : isVoicing(si, fi)
                                                                    ? "0 0 4px 0.5px #f59e0b"
                                                                    : "none",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontWeight: "bold",
                                                                fontSize: "0.95rem",
                                                                color: "#fff",
                                                                position: "relative",
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    width: "100%",
                                                                    textAlign: "center",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    height: "100%",
                                                                    fontWeight: "bold",
                                                                }}
                                                            >
                                                                {noteName}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Dot inlays */}
                        <div className="absolute inset-0 pointer-events-none">
                            {DOT_FRETS.map((fret) => {
                                const start = (fret / (FRETS + 1)) * 100;
                                const end = ((fret + 1) / (FRETS + 1)) * 100;
                                const left = (start + end) / 2;

                                const isDouble = (fret === 12 || fret === 24);
                                const dotElements = isDouble ? [{ top: "33%" }, { top: "67%" }] : [{ top: "50%" }];

                                return (
                                    <div key={`dot-${fret}`} style={{ left: `${left}%` }} className="absolute transform -translate-x-1/2 w-0 h-full flex items-center justify-center">
                                        {dotElements.map((d, i) => (
                                            <div key={i} style={{ top: d.top }} className="absolute -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 shadow" />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Fret numbers below the fretboard */}
                    <div className="mt-2 flex justify-between text-xs text-slate-200" style={{ minWidth: "1075px", width: "100%" }}>
                        {Array.from({ length: FRETS + 1 }).map((_, fi) => (
                            <div key={`fnum-${fi}`} className="flex-1 text-center">{fi}</div>
                        ))}
                    </div>
                </div>
                {/* Chord chart (fixed, not scrollable) */}
                {showChordChart && (
                <div className="flex flex-col items-center justify-start">
                    <div
                    className="bg-white rounded-lg shadow-lg flex items-center justify-center"
                    style={{
                        width: 180,
                        height: 180,
                        minWidth: 180,
                        minHeight: 180,
                    }}
                    >
                    {/* Render message if can't render chord */}
                    {(() => {
                        const chordChart = getChordChartFromSelectedFrets(selectedChordFrets);
                        if ((chordChart as any).cantRender) {
                            return (
                                <span className="text-red-600 font-semibold text-center px-2">
                                    Can't render this chord
                                </span>
                            );
                        }
                        return (
                            <Chord
                                chord={chordChart}
                                instrument={instrument}
                                lite={lite}
                            />
                        );
                    })()}
                    </div>
                </div>
                )}
            </div>
            {/* Buttons + chord chart (don’t scroll) */}
            <div className="mt-4 flex gap-6 justify-center items-start">
                {/* Buttons */}
                <div className="flex gap-4">
                <Button
                    onClick={replayChord}
                    className="bg-blue-700 border border-blue-600 text-white rounded hover:bg-blue-600"
                >
                    Replay Chord
                </Button>
                <Button
                    onClick={clearChord}
                    className="bg-green-700 border border-green-600 text-white rounded hover:bg-green-600"
                >
                    Clear Chord ({selectedChordFrets.length} notes)
                </Button>
                <Button
                    className={`px-4 border py-2 rounded text-white transition ${
                    showChordChart
                        ? "bg-slate-600 hover:bg-slate-700 border-slate-600"
                        : "bg-slate-500 hover:bg-slate-600 border-slate-500"
                    }`}
                    onClick={() => setShowChordChart((v) => !v)}
                >
                    {showChordChart ? "Hide Chord Chart" : "Show Chord Chart"}
                </Button>
                </div>
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
    );
}