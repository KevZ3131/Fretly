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

  const [cursorPosition, setCursorPosition] = useState({ measureIndex: 0, noteIndex: 0 })
  const [totalNotes, setTotalNotes] = useState(0)

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

  // Initialize OSMD cursor and force style
  const initializeCursor = () => {
    if (!osmdRef.current) return
    try {
      osmdRef.current.cursor.show()
      osmdRef.current.cursor.reset()

      const el = osmdRef.current.cursor.cursorElement as HTMLElement
      if (el) {
        el.style.position = "absolute"
        el.style.zIndex = "9999"
        el.style.width = "25px"
        el.style.height = "220px"
        el.style.backgroundColor = "lightgreen"
        el.style.opacity = "0.8"
        el.style.display = "block"
      }
    } catch (err) {
      console.warn("Cursor initialization failed:", err)
    }
  }

  const moveCursorNext = () => {
    if (!osmdRef.current?.cursor) return
    try {
      osmdRef.current.cursor.next() // move to next voice entry
    } catch (err) {
      console.warn("Next navigation error:", err)
    }
  }

  const moveCursorPrev = () => {
    if (!osmdRef.current?.cursor) return
    try {
      osmdRef.current.cursor.previous() // move to previous voice entry
    } catch (err) {
      console.warn("Prev navigation error:", err)
    }
  }

  const startPlay = (intervalMs = 600) => {
    if (isPlayingRef.current || !osmdRef.current) return
    isPlayingRef.current = true

    playIntervalRef.current = window.setInterval(() => {
      const cursor = osmdRef.current.cursor
      if (cursor.iterator.endReached) {
        stopPlay()
        return
      }
      moveCursorNext()
    }, intervalMs)
  }

  const stopPlay = () => {
    if (playIntervalRef.current) {
      window.clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
    isPlayingRef.current = false
  }

  useEffect(() => {
    return () => stopPlay()
  }, [])

  // expose score navigation to global store so TabRenderer can trigger it
  useEffect(() => {
    // register no-ops until osmdRef is created
    useStore.getState().setScoreNavigator(undefined, undefined)
    return () => {
      useStore.getState().setScoreNavigator(undefined, undefined)
    }
  }, [])

  const handleNext = () => {
    // call central navigator so both score and tab move together
    useStore.getState().navigateNext()
  }
  const handlePrev = () => {
    useStore.getState().navigatePrev()
  }

  async function uploadFile() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setError(null)
    setLoading(true)

    try {
      if (!osmdRef.current && outputRef.current) {
        const OSMD = (OpenSheetMusicDisplay as any).OpenSheetMusicDisplay || OpenSheetMusicDisplay
        osmdRef.current = new OSMD(outputRef.current, {
          autoResize: true,
          drawTitle: true,
          drawingParameters: "compacttight",
          renderSingleHorizontalStaffline: true,
          cursorOptions: {
            type: 1,
            color: "red",
            alpha: 0.8,
          },
        })

        // register score navigation functions in the store
        useStore.getState().setScoreNavigator(
          () => {
            try { osmdRef.current?.cursor?.next() } catch {}
          },
          () => {
            try { osmdRef.current?.cursor?.previous() } catch {}
          }
        )
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
              xmlString = candidate
              loaded = true
              break
            }
            if (!loaded) throw new Error("No valid MusicXML found in .mxl")
          } else {
            xmlString = reader.result as string
            if (!isLikelyMusicXML(xmlString)) throw new Error("Uploaded file doesn't appear to be valid MusicXML.")
          }

          if (osmdRef.current && xmlString) {
            await osmdRef.current.load(xmlString)
            await osmdRef.current.render()
            initializeCursor()

            // reset tabs when a new score is uploaded
            try {
              useStore.getState().clearTabs?.()
            } catch (err) {
              // ignore
            }
          }

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

  useEffect(() => {
    return () => {
      // cleanup store registration on unmount
      useStore.getState().setScoreNavigator(undefined, undefined)
      stopPlay()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <h2 className="text-xl font-bold mb-4 text-white">Upload MusicXML and View Score</h2>

      <input
        type="file"
        ref={fileInputRef}
        accept=".xml,.musicxml,.mxl"
        className="mb-4 block w-full text-sm text-slate-300
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-600 file:text-white
          hover:file:bg-blue-700"
      />

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={uploadFile}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Upload and Render"}
        </button>
        <button
          onClick={handlePrev}
          disabled={!osmdRef.current}
          className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50"
        >
          ◀ Prev
        </button>
        <button
          onClick={handleNext}
          disabled={!osmdRef.current}
          className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50"
        >
          Next ▶
        </button>
        <button
          onClick={() => startPlay(300)}
          disabled={!osmdRef.current || isPlayingRef.current}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Play ►
        </button>
        <button
          onClick={stopPlay}
          disabled={!isPlayingRef.current}
          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          Stop ■
        </button>
      </div>

      {loading && <div className="text-blue-400 mb-2">Loading and parsing score...</div>}
      {error && <div className="text-red-500 mb-2">{error}</div>}

      <div className="bg-slate-800 p-3 rounded mb-4">
        <div className="text-sm text-slate-300">
          Position: Measure {cursorPosition.measureIndex + 1}, Note {cursorPosition.noteIndex + 1}
          {totalNotes > 0 && ` of ${totalNotes}`}
        </div>
      </div>

      <div
        id="output"
        ref={outputRef}
        className="bg-white rounded shadow p-4 overflow-auto"
        style={{ minHeight: 400 }}
      />
    </div>
  )
}
