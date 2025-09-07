"use client"

import { useRef, useState, useEffect } from "react"
// @ts-ignore
import OpenSheetMusicDisplay from "opensheetmusicdisplay"
import { unzipSync, strFromU8 } from "fflate"
import { useStore } from "@/store/store"

export default function ScoreViewer() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<any>(null)
  const playIntervalRef = useRef<number | null>(null)
  const isPlayingRef = useRef(false)
  const { addActiveNote, clearActiveNotes } = useStore()

  // parsed measures (array of pitch arrays)
  const measuresRef = useRef<string[][]>([])
  const [measureIndex, setMeasureIndex] = useState(0)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  // small validator for MusicXML (fast)
  const isLikelyMusicXML = (xml: string | null) => {
    if (!xml) return false
    const lowered = xml.slice(0, 2000).toLowerCase()
    return (
      lowered.includes("<score-partwise") ||
      lowered.includes("<score-timewise") ||
      lowered.includes("<part-list") ||
      lowered.includes("<part ")
    )
  }

  // Parse MusicXML -> measures of pitch strings like "C4", "D#3"
  const parseMusicXMLToMeasures = (xmlString: string): string[][] => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, "application/xml")
    if (doc.querySelector("parsererror")) throw new Error("Invalid XML")
    const parts = Array.from(doc.querySelectorAll("part"))
    if (!parts.length) throw new Error("No <part> elements found")

    const partMeasures: string[][][] = parts.map((part) => {
      const measures = Array.from(part.getElementsByTagName("measure"))
      return measures.map((measure) => {
        const notes: string[] = []
        const noteElems = Array.from(measure.getElementsByTagName("note"))
        for (const noteEl of noteElems) {
          if (noteEl.getElementsByTagName("rest").length) continue
          const pitch = noteEl.getElementsByTagName("pitch")[0]
          if (!pitch) continue
          const step = pitch.getElementsByTagName("step")[0]?.textContent
          const alterEl = pitch.getElementsByTagName("alter")[0]?.textContent
          const octave = pitch.getElementsByTagName("octave")[0]?.textContent
          if (!step || !octave) continue
          let name = step
          if (alterEl) {
            const alter = parseInt(alterEl, 10)
            if (alter === 1) name += "#"
            if (alter === -1) name += "b"
          }
          notes.push(`${name}${octave}`)
        }
        return notes
      })
    })

    const maxMeasures = Math.max(...partMeasures.map(pm => pm.length), 0)
    const merged: string[][] = []
    for (let i = 0; i < maxMeasures; i++) {
      const set = new Set<string>()
      for (const pm of partMeasures) {
        const m = pm[i] || []
        m.forEach(n => set.add(n))
      }
      merged.push(Array.from(set))
    }
    return merged
  }

  // overlay positioning: simple approximation using first rendered SVG width
  const positionOverlay = (index: number) => {
    if (!outputRef.current) return
    const svg = outputRef.current.querySelector("svg")
    if (!svg) return
    const svgRect = svg.getBoundingClientRect()
    const containerRect = outputRef.current.getBoundingClientRect()
    const totalMeasures = Math.max(measuresRef.current.length, 1)
    const measureWidth = svgRect.width / totalMeasures
    const left = (index * measureWidth) + (svgRect.left - containerRect.left)
    if (!overlayRef.current) {
      const ov = document.createElement("div")
      ov.style.position = "absolute"
      ov.style.top = "0"
      ov.style.height = "100%"
      ov.style.width = `${Math.max(8, measureWidth)}px`
      ov.style.background = "rgba(34,197,94,0.15)"
      ov.style.borderLeft = "3px solid rgba(16,185,129,0.9)"
      ov.style.pointerEvents = "none"
      outputRef.current.style.position = outputRef.current.style.position || "relative"
      outputRef.current.appendChild(ov)
      overlayRef.current = ov
    }
    const ov = overlayRef.current
    ov.style.left = `${left}px`
    ov.style.width = `${Math.max(8, measureWidth)}px`
  }

  // update shared store with notes for current measure (piano subscribes and plays)
  const updateCursorFromMeasures = (index: number) => {
    clearActiveNotes()
    const measures = measuresRef.current
    if (!measures || measures.length === 0) return
    const idx = Math.max(0, Math.min(index, measures.length - 1))
    const notes = measures[idx] || []
    notes.forEach((n) => addActiveNote(n))
    setTimeout(() => positionOverlay(idx), 50)
  }

  const startPlay = (intervalMs = 600) => {
    if (isPlayingRef.current) return
    isPlayingRef.current = true
    playIntervalRef.current = window.setInterval(() => {
      setMeasureIndex(prev => {
        const next = Math.min(prev + 1, Math.max(0, measuresRef.current.length - 1))
        updateCursorFromMeasures(next)
        return next
      })
    }, intervalMs)
  }

  const stopPlay = () => {
    if (playIntervalRef.current) {
      window.clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
    isPlayingRef.current = false
  }

  useEffect(() => { return () => stopPlay() }, [])

  const handleNext = () => {
    setMeasureIndex(prev => {
      const next = Math.min(prev + 1, Math.max(0, measuresRef.current.length - 1))
      updateCursorFromMeasures(next)
      return next
    })
  }

  const handlePrev = () => {
    setMeasureIndex(prev => {
      const next = Math.max(prev - 1, 0)
      updateCursorFromMeasures(next)
      return next
    })
  }

  async function uploadFile() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setError(null)
    setLoading(true)

    try {
      // try init OSMD for rendering (non-blocking)
      if (!osmdRef.current && outputRef.current) {
        try {
          const OSMD = (OpenSheetMusicDisplay as any).OpenSheetMusicDisplay || OpenSheetMusicDisplay
          osmdRef.current = new OSMD(outputRef.current)
          if (typeof osmdRef.current.setOptions === "function") {
            osmdRef.current.setOptions({
              autoResize: true,
              drawingParameters: "compacttight",
              drawTitle: false,
              renderSingleHorizontalStaffline: true
            })
          }
        } catch (initErr) {
          console.warn("OSMD init failed (rendering may not work):", initErr)
        }
      }

      if (outputRef.current) outputRef.current.innerHTML = ""

      const reader = new FileReader()
      reader.onload = async () => {
        try {
          let xmlString: string | null = null

          if (file.name.toLowerCase().endsWith(".mxl")) {
            const uint8 = new Uint8Array(reader.result as ArrayBuffer)
            const files = unzipSync(uint8)
            const xmlFiles = Object.keys(files).filter(k => k.toLowerCase().endsWith(".xml"))
            let loaded = false
            for (const name of xmlFiles) {
              const candidate = strFromU8(files[name])
              if (!isLikelyMusicXML(candidate)) continue
              try {
                const parsedMeasures = parseMusicXMLToMeasures(candidate)
                if (parsedMeasures.length) {
                  measuresRef.current = parsedMeasures
                  xmlString = candidate
                  loaded = true
                  break
                }
              } catch (e) {
                console.warn("candidate parse failed", name, e)
                continue
              }
            }
            if (!loaded) throw new Error("No valid MusicXML found in .mxl")
          } else {
            xmlString = reader.result as string
            if (!isLikelyMusicXML(xmlString)) throw new Error("Uploaded file doesn't appear to be valid MusicXML.")
            measuresRef.current = parseMusicXMLToMeasures(xmlString)
          }

          // render with OSMD if available (best-effort)
          try {
            if (osmdRef.current && xmlString) {
              await osmdRef.current.load(xmlString)
              osmdRef.current.render()
            }
          } catch (renderErr) {
            console.warn("OSMD render failed (playback still available):", renderErr)
          }

          setMeasureIndex(0)
          updateCursorFromMeasures(0)
          setLoading(false)
        } catch (err: any) {
          console.error("Load error:", err)
          setError(err.message || String(err))
          setLoading(false)
        }
      }

      reader.onerror = () => {
        setError("Could not read file.")
        setLoading(false)
      }

      if (file.name.toLowerCase().endsWith(".mxl")) {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsText(file)
      }
    } catch (err: any) {
      console.error("Upload error:", err)
      setError(err.message || String(err))
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <h2 className="text-xl font-bold mb-4 text-white">Upload MusicXML and View Score</h2>

      <input type="file" ref={fileInputRef} accept=".xml,.musicxml,.mxl" className="mb-4 block" />
      <div className="flex items-center gap-2 mb-4">
        <button onClick={uploadFile} className="px-3 py-1 bg-blue-700 text-white rounded">Upload and Render</button>
        <button onClick={handlePrev} className="px-3 py-1 bg-slate-700 text-white rounded">◀ Prev</button>
        <button onClick={handleNext} className="px-3 py-1 bg-slate-700 text-white rounded">Next ▶</button>
        <button onClick={() => startPlay(600)} className="px-3 py-1 bg-green-600 text-white rounded">Play ►</button>
        <button onClick={stopPlay} className="px-3 py-1 bg-red-600 text-white rounded">Stop ■</button>
      </div>

      {loading && <div className="text-blue-400 mb-2">Loading and parsing score...</div>}
      {error && <div className="text-red-500 mb-2">{error}</div>}

      <div id="output" ref={outputRef} className="bg-white rounded shadow p-2 overflow-auto" style={{ minHeight: 300, minWidth: 300 }} />
    </div>
  )
}
