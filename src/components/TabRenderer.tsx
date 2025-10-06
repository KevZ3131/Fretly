'use client'
import React, { useEffect, useRef, useState, useCallback } from "react"
// Force import from v5’s ESM entry
// @ts-ignore
import { Renderer, TabStave, TabNote, Voice, Formatter } from "vexflow"
import { useCaretIndex, useStore } from "@/store/store"
import { zipSync } from "fflate" // added import

type FretPos = { string: number /* 0 = low E (6th) .. 5 = high E (1st) */, fret: number }
type ScoreEvent = { duration: string /* "q","8","h" etc */, notes: FretPos[] }

interface TabRendererProps {
  hasScore: boolean
  currentNotes: FretPos[]
  // updated: onNavigate now receives both index and the positions for that slot
  onNavigate?: (index: number, positions?: { str: number; fret: number }[]) => void
  scoreEvents?: ScoreEvent[]
  resetKey?: string | number
}

export default function TabRenderer({
  hasScore,
  currentNotes,
  onNavigate,
  scoreEvents,
  resetKey,
}: TabRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const rendererRef = useRef<any>(null)
  const contextRef = useRef<any>(null)
  const vfNotesRef = useRef<any[]>([]) // store last VexFlow TabNotes
  const {caretIndex, setCaretIndex} = useCaretIndex()
  const slotsRef = useRef<{ duration: string; positions: { str: number; fret: number }[] }[]>([])
  const vfWidthPerSlot = 140

  // Initialize / reset renderer
  useEffect(() => {
    if (!containerRef.current) return

    // Clean previous
    if (rendererRef.current) {
      try { rendererRef.current.getContext().clear() } catch {}
      rendererRef.current = null
      contextRef.current = null
      svgRef.current = null
      containerRef.current.innerHTML = ""
    }

    const div = containerRef.current
    const renderer = new Renderer(div, Renderer.Backends.SVG)
    rendererRef.current = renderer
    renderer.resize(vfWidthPerSlot * 4, 140)
    const context = renderer.getContext()
    contextRef.current = context
    svgRef.current = div.querySelector("svg") as SVGSVGElement | null

    // Initialize first slot
    slotsRef.current = [{ duration: "q", positions: [] }]
    setCaretIndex(0)
    drawAll()
    scrollToCaret()
  }, [resetKey, hasScore])

  // Convert slot to VexFlow TabNote
  const slotToTabNote = (slot: { duration: string; positions: { str: number; fret: number }[] }) => {
    if (!slot.positions || slot.positions.length === 0) {
        return new TabNote({ positions: [{ str: 6, fret: "x" }], duration: slot.duration })
    }
    const positions = slot.positions.map(p => ({ str: p.str + 1, fret: String(p.fret) }))
    return new TabNote({ positions, duration: slot.duration })
}


  // Draw everything
  const drawAll = useCallback(() => {
    const renderer = rendererRef.current
    const context = contextRef.current
    if (!renderer || !context || !containerRef.current) return

    const slotCount = Math.max(1, slotsRef.current.length)
    const width = Math.max(vfWidthPerSlot * slotCount, containerRef.current.clientWidth || 400)
    const height = 140
    renderer.resize(width, height)
    context.clear()

    const staveX = 10
    const stave = new TabStave(staveX, 10, width - 20)
    stave.addTabGlyph()
    stave.setContext(context).draw()

    const vfNotes = slotsRef.current.map(slotToTabNote)
    vfNotesRef.current = vfNotes // keep reference for caret alignment

    // Use infinite voice with no time constraints
    const voice = new Voice({ num_beats: 999999, beat_value: 4 })

    // Ensure voice is in SOFT mode so VexFlow does not throw IncompleteVoice for non-exact tick totals
    if ((voice as any).setMode) {
      try {
        (voice as any).setMode(Voice.Mode.SOFT)
      } catch {
        // ignore if not available
      }
    }

    // add tickables so the voice contains the notes before formatting/drawing
    vfNotes.forEach(n => voice.addTickable(n))

    const formatter = new Formatter()
    try {
      formatter.joinVoices([voice]).format([voice], width - 40)
    } catch (err) {
      // Formatting may fail if durations are irregular; continue to draw what we have
      console.warn("VexFlow formatter error (ignored):", err)
    }
    voice.draw(context, stave)

    // After drawing, align caret to the actual rendered note position
    drawCaret(stave)
  }, [caretIndex])

  // Draw caret (use actual TabNote absolute X when available)
  const drawCaret = (stave?: any) => {
    const svg = svgRef.current
    if (!svg) return
    const old = svg.querySelector('.tab-caret')
    if (old) old.remove()

    let x = 10 + caretIndex * vfWidthPerSlot + vfWidthPerSlot / 2 // fallback

    const note = vfNotesRef.current?.[caretIndex]
    try {
      if (note && typeof note.getAbsoluteX === "function") {
        // getAbsoluteX sometimes already includes stave offsets; try to use it directly
        const abs = note.getAbsoluteX()
        if (typeof abs === "number" && !isNaN(abs) && abs > 0) {
          x = abs
        } else if (stave && typeof stave.getX === "function") {
          // fallback: combine stave x + note internal x
          x = (stave.getX ? stave.getX() : 10) + (abs || 0)
        }
      }
    } catch (err) {
      // ignore and use fallback x
      // console.warn("caret x compute failed", err)
    }

    const caret = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    caret.setAttribute("class", "tab-caret")
    caret.setAttribute("x", String(x - 6))
    caret.setAttribute("y", "4")
    caret.setAttribute("width", "12")
    caret.setAttribute("height", "8")
    caret.setAttribute("fill", "limegreen")
    caret.setAttribute("opacity", "0.9")
    svg.appendChild(caret)
  }

  const scrollToCaret = () => {
    const container = containerRef.current
    if (!container) return
    // try to use accurate note x to decide scrolling
    let slotX = caretIndex * vfWidthPerSlot
    const note = vfNotesRef.current?.[caretIndex]
    try {
      if (note && typeof note.getAbsoluteX === "function") {
        const abs = note.getAbsoluteX()
        if (typeof abs === "number" && !isNaN(abs) && abs > 0) slotX = abs
      }
    } catch {}
    const viewLeft = container.scrollLeft
    const viewRight = viewLeft + container.clientWidth
    if (slotX + vfWidthPerSlot > viewRight || slotX < viewLeft) {
      const target = Math.max(0, slotX - container.clientWidth / 2 + vfWidthPerSlot / 2)
      container.scrollTo({ left: target, behavior: "smooth" })
    }
  }

  // Update when currentNotes change
  useEffect(() => {
    const incoming = currentNotes || []
    const positions = incoming.map(n => ({ str: n.string, fret: n.fret }))
    while (slotsRef.current.length <= caretIndex) slotsRef.current.push({ duration: "q", positions: [] })
    slotsRef.current[caretIndex] = { duration: slotsRef.current[caretIndex].duration || "q", positions }
    drawAll()
    scrollToCaret()
  }, [currentNotes, caretIndex, drawAll])

  // clear tabs implementation to register in store
  const clearTabs = useCallback(() => {
    slotsRef.current = [{ duration: "q", positions: [] }]
    setCaretIndex(0)
    drawAll()
    scrollToCaret()
    onNavigate?.(0, slotsRef.current[0]?.positions ?? [])
  }, [drawAll, onNavigate])

  // keep latest clearTabs in a ref and register a stable wrapper once
  const clearTabsRef = useRef(clearTabs)
  useEffect(() => { clearTabsRef.current = clearTabs }, [clearTabs])
  useEffect(() => {
    useStore.getState().setClearTabs(() => () => {
      try { clearTabsRef.current?.() } catch {}
    })
    return () => { useStore.getState().setClearTabs(undefined) }
  }, [])

  // NEW: subscribe to numeric signal and trigger clear when it increments
  const clearSignal = useStore(state => state.clearTabsSignal)
  useEffect(() => {
    if (!clearSignal) return // ignore initial 0
    try {
      clearTabsRef.current && clearTabsRef.current()
    } catch (err) {
      // ignore
    }
  }, [clearSignal])

  // Register tab navigator (stable wrapper) once; store will call this when navigating centrally
  const navigateToIndex = useCallback((newIndex: number) => {
    if (newIndex < 0) newIndex = 0

    if (!hasScore || !scoreEvents || scoreEvents.length === 0) {
      while (slotsRef.current.length <= newIndex) slotsRef.current.push({ duration: "q", positions: [] })
      setCaretIndex(newIndex)
      drawAll()
      scrollToCaret()
      onNavigate?.(newIndex, slotsRef.current[newIndex]?.positions ?? [])
      return
    }

    const clamped = Math.min(newIndex, (scoreEvents?.length || 1) - 1)
    slotsRef.current = scoreEvents.map(s => ({
      duration: s.duration,
      positions: s.notes.map(n => ({ str: n.string, fret: n.fret })),
    }))
    setCaretIndex(clamped)
    drawAll()
    scrollToCaret()
    onNavigate?.(clamped, slotsRef.current[clamped]?.positions ?? [])
  }, [hasScore, scoreEvents, drawAll, onNavigate])

  // keep refs to latest navigateToIndex so the stable wrapper can call it
  const tabNextRef = useRef<() => void>(null)
  const tabPrevRef = useRef<() => void>(null)
  useEffect(() => {
    tabNextRef.current = () => navigateToIndex(caretIndex + 1)
    tabPrevRef.current = () => navigateToIndex(caretIndex - 1)
  }, [navigateToIndex, caretIndex])

  useEffect(() => {
    useStore.getState().setTabNavigator(
      () => { try { tabNextRef.current && tabNextRef.current() } catch {} },
      () => { try { tabPrevRef.current && tabPrevRef.current() } catch {} }
    )
    return () => {
      useStore.getState().setTabNavigator(undefined, undefined)
    }
  }, [])

  // Arrow buttons now call the central navigator so they are the same as ScoreViewer arrows
  const handleNextClick = useCallback(() => { useStore.getState().navigateNext() }, [])
  const handlePrevClick = useCallback(() => { useStore.getState().navigatePrev() }, [])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); handleNextClick() }
      if (e.key === "ArrowLeft") { e.preventDefault(); handlePrevClick() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleNextClick, handlePrevClick])

  // Initialize from scoreEvents
  useEffect(() => {
    if (hasScore && scoreEvents?.length) {
      slotsRef.current = scoreEvents.map(s => ({
        duration: s.duration,
        positions: s.notes.map(n => ({ str: n.string, fret: n.fret })),
      }))
      setCaretIndex(0)
      drawAll()
      scrollToCaret()
      onNavigate?.(0, slotsRef.current[0]?.positions ?? [])
    } else if (!hasScore && (!slotsRef.current || slotsRef.current.length === 0)) {
      slotsRef.current = [{ duration: "q", positions: [] }]
      setCaretIndex(0)
      drawAll()
      scrollToCaret()
      onNavigate?.(0, slotsRef.current[0]?.positions ?? [])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasScore, scoreEvents])

  // Export MusicXML from current tab slots (MuseScore-friendly: standard staff + tab staff)
  const handleExportMusicXML = () => {
    const indent = (level: number) => "  ".repeat(level)

    // Match Fretboard tuning (MIDI numbers)
    const STANDARD_TUNING_MIDI = [64, 59, 55, 50, 45, 40] // [E4, B3, G3, D3, A2, E2]
    const STEP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    const midiToPitchParts = (midi: number) => {
      const stepIndex = ((midi % 12) + 12) % 12
      const step = STEP_NAMES[stepIndex]
      const octave = Math.floor(midi / 12) - 1
      const alter = step.includes("#") ? 1 : 0
      return { step: step.replace("#", ""), alter, octave }
    }

    const pitchNoteXml = (pos: { str: number; fret: number }, isChord: boolean, staff: number, voice: number, level: number) => {
      // pos.str: 0 = low E (6th) .. 5 = high E (1st)
      const stringIndex = Math.max(0, Math.min(5, pos.str))
      const fret = Math.max(0, pos.fret)
      const midi = (STANDARD_TUNING_MIDI[stringIndex] ?? 40) + fret
      const { step, alter, octave } = midiToPitchParts(midi)

      const lines: string[] = []
      lines.push(`${indent(level)}<note>`)
      if (isChord) lines.push(`${indent(level+1)}<chord/>`)
      lines.push(`${indent(level+1)}<pitch>`)
      lines.push(`${indent(level+2)}<step>${step}</step>`)
      if (alter) lines.push(`${indent(level+2)}<alter>${alter}</alter>`)
      lines.push(`${indent(level+2)}<octave>${octave}</octave>`)
      lines.push(`${indent(level+1)}</pitch>`)
      lines.push(`${indent(level+1)}<duration>1</duration>`)
      lines.push(`${indent(level+1)}<voice>${voice}</voice>`)
      lines.push(`${indent(level+1)}<type>quarter</type>`)
      lines.push(`${indent(level+1)}<staff>${staff}</staff>`)
      lines.push(`${indent(level)}</note>`)
      return lines.join("\n")
    }

    const tabNoteXml = (pos: { str: number; fret: number }, isChord: boolean, staff: number, voice: number, level: number) => {
      // produce a tab note: include pitch for alignment and <notations><technical> for string/fret
      const stringIndex = Math.max(0, Math.min(5, pos.str))
      const fret = Math.max(0, pos.fret)
      const midi = (STANDARD_TUNING_MIDI[stringIndex] ?? 40) + fret
      const { step, alter, octave } = midiToPitchParts(midi)

      const stringNumberForMusicXML = 6 - stringIndex // internal 0=lowE -> MusicXML string=6

      const lines: string[] = []
      lines.push(`${indent(level)}<note>`)
      if (isChord) lines.push(`${indent(level+1)}<chord/>`)
      lines.push(`${indent(level+1)}<pitch>`)
      lines.push(`${indent(level+2)}<step>${step}</step>`)
      if (alter) lines.push(`${indent(level+2)}<alter>${alter}</alter>`)
      lines.push(`${indent(level+2)}<octave>${octave}</octave>`)
      lines.push(`${indent(level+1)}</pitch>`)
      lines.push(`${indent(level+1)}<duration>1</duration>`)
      lines.push(`${indent(level+1)}<voice>${voice}</voice>`)
      lines.push(`${indent(level+1)}<type>quarter</type>`)
      lines.push(`${indent(level+1)}<staff>${staff}</staff>`)
      lines.push(`${indent(level+1)}<notations>`)
      lines.push(`${indent(level+2)}<technical>`)
      lines.push(`${indent(level+3)}<string>${stringNumberForMusicXML}</string>`)
      lines.push(`${indent(level+3)}<fret>${fret}</fret>`)
      lines.push(`${indent(level+2)}</technical>`)
      lines.push(`${indent(level+1)}</notations>`)
      lines.push(`${indent(level)}</note>`)
      return lines.join("\n")
    }

    // Collect all notes into a single measure
    const measuresLines: string[] = []
    measuresLines.push(`${indent(2)}<measure number="1">`)

    // Add staff/clef attributes at start
    measuresLines.push(`${indent(3)}<attributes>`)
    measuresLines.push(`${indent(4)}<divisions>1</divisions>`)
    measuresLines.push(`${indent(4)}<key><fifths>0</fifths></key>`)
    measuresLines.push(`${indent(4)}<staves>2</staves>`)
    measuresLines.push(`${indent(4)}<clef number="1">`)
    measuresLines.push(`${indent(5)}<sign>G</sign>`)
    measuresLines.push(`${indent(5)}<line>2</line>`)
    measuresLines.push(`${indent(4)}</clef>`)
    measuresLines.push(`${indent(4)}<clef number="2">`)
    measuresLines.push(`${indent(5)}<sign>TAB</sign>`)
    measuresLines.push(`${indent(5)}<line>6</line>`)
    measuresLines.push(`${indent(4)}</clef>`)
    // staff 1 (standard)
    measuresLines.push(`${indent(4)}<staff-details number="1">`)
    measuresLines.push(`${indent(5)}<staff-lines>5</staff-lines>`)
    measuresLines.push(`${indent(4)}</staff-details>`)
    // staff 2 (tab)
    measuresLines.push(`${indent(4)}<staff-details number="2">`)
    measuresLines.push(`${indent(5)}<staff-lines>6</staff-lines>`)
    measuresLines.push(`${indent(5)}<staff-type>tab</staff-type>`)
    measuresLines.push(`${indent(5)}<show-frets>numbers</show-frets>`)
    // tuning entries (top to bottom)
    const tuning = [
      { step: "E", octave: 4 },
      { step: "B", octave: 3 },
      { step: "G", octave: 3 },
      { step: "D", octave: 3 },
      { step: "A", octave: 2 },
      { step: "E", octave: 2 },
    ]
    tuning.forEach((t, i) => {
      measuresLines.push(`${indent(5)}<staff-tuning line="${i + 1}">`)
      measuresLines.push(`${indent(6)}<tuning-step>${t.step}</tuning-step>`)
      measuresLines.push(`${indent(6)}<tuning-octave>${t.octave}</tuning-octave>`)
      measuresLines.push(`${indent(5)}</staff-tuning>`)
    })
    measuresLines.push(`${indent(4)}</staff-details>`)
    measuresLines.push(`${indent(3)}</attributes>`)

    // Add all notes in sequence
    slotsRef.current.forEach((slot) => {
      if (slot.positions && slot.positions.length > 0) {
        // Emit standard staff notes first (staff=1, voice=1)
        for (let i = 0; i < slot.positions.length; i++) {
          const isChord = i > 0
          measuresLines.push(pitchNoteXml(slot.positions[i], isChord, 1, 1, 3))
        }

        // Insert backup to reset time cursor for simultaneous tab notes
        measuresLines.push(`${indent(3)}<backup>`)
        measuresLines.push(`${indent(4)}<duration>1</duration>`)
        measuresLines.push(`${indent(3)}</backup>`)

        // Emit tablature staff notes (staff=2, voice=2)
        for (let i = 0; i < slot.positions.length; i++) {
          const isChord = i > 0
          measuresLines.push(tabNoteXml(slot.positions[i], isChord, 2, 2, 3))
        }
      } else {
        // rest in both staves
        measuresLines.push(`${indent(3)}<note>`)
        measuresLines.push(`${indent(4)}<rest/>`)
        measuresLines.push(`${indent(4)}<duration>1</duration>`)
        measuresLines.push(`${indent(4)}<voice>1</voice>`)
        measuresLines.push(`${indent(4)}<type>quarter</type>`)
        measuresLines.push(`${indent(4)}<staff>1</staff>`)
        measuresLines.push(`${indent(3)}</note>`)
        measuresLines.push(`${indent(3)}<note>`)
        measuresLines.push(`${indent(4)}<rest/>`)
        measuresLines.push(`${indent(4)}<duration>1</duration>`)
        measuresLines.push(`${indent(4)}<voice>2</voice>`)
        measuresLines.push(`${indent(4)}<type>quarter</type>`)
        measuresLines.push(`${indent(4)}<staff>2</staff>`)
        measuresLines.push(`${indent(3)}</note>`)
      }
    })

    measuresLines.push(`${indent(2)}</measure>`)

    const xmlLines = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<!DOCTYPE score-partwise PUBLIC`,
      `  "-//Recordare//DTD MusicXML 3.1 Partwise//EN"`,
      `  "http://www.musicxml.org/dtds/partwise.dtd">`,
      `<score-partwise version="3.1">`,
      `${indent(1)}<part-list>`,
      `${indent(2)}<score-part id="P1">`,
      `${indent(3)}<part-name>Guitar (Standard + Tab)</part-name>`,
      `${indent(3)}<score-instrument id="P1-I1"><instrument-name>Guitar</instrument-name></score-instrument>`,
      `${indent(2)}</score-part>`,
      `${indent(1)}</part-list>`,
      `${indent(1)}<part id="P1">`,
      ...measuresLines,
      `${indent(1)}</part>`,
      `</score-partwise>`
    ]

    const musicXml = xmlLines.join("\n")

    // package as .mxl (unchanged)
    try {
      const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml"/>
  </rootfiles>
</container>`
      const files: Record<string, Uint8Array> = {
        "score.xml": new TextEncoder().encode(musicXml),
        "META-INF/container.xml": new TextEncoder().encode(containerXml),
      }
      const zipped = zipSync(files)
      const uint8 = zipped instanceof Uint8Array ? zipped : new Uint8Array(zipped as any)
      const blob = new Blob([uint8.buffer], { type: "application/zip" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "fretly_tab.mxl"
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 150)
    } catch (err) {
      // fallback
      const blob = new Blob([musicXml], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "fretly_tab.xml"
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 150)
    }
  };

  // Export PDF: use VexFlow Canvas backend to render offscreen, then create real PDF via jsPDF
  const handleExportPDF = async () => {
    // Create offscreen container
    const off = document.createElement("div")
    off.style.position = "fixed"
    off.style.left = "-10000px"
    document.body.appendChild(off)

    try {
      // Create a real HTMLCanvasElement and pass it to VexFlow Canvas renderer
      const canvasEl = document.createElement("canvas")
      // ensure it's attached so VexFlow can initialize it
      off.appendChild(canvasEl)

      // Create a VexFlow renderer using Canvas backend on the canvas element
      const offRenderer = new Renderer(canvasEl, Renderer.Backends.CANVAS)
      const slotCount = Math.max(1, slotsRef.current.length)
      const width = Math.max(vfWidthPerSlot * slotCount, 400)
      const height = 140
      // let VexFlow set the canvas internal size
      offRenderer.resize(width, height)
      const offContext = offRenderer.getContext()

      // Draw stave + notes into the offscreen renderer (same logic as drawAll)
      const staveX = 10
      const stave = new TabStave(staveX, 10, width - 20)
      stave.addTabGlyph()
      stave.setContext(offContext).draw()

      const vfNotes = slotsRef.current.map(slotToTabNote)
      const voice = new Voice({ num_beats: 4, beat_value: 4 })
      if ((voice as any).setMode) {
        try { (voice as any).setMode(Voice.Mode.SOFT) } catch {}
      }
      vfNotes.forEach(n => voice.addTickable(n))
      const formatter = new Formatter()
      try { formatter.joinVoices([voice]).format([voice], width - 40) } catch (err) { /* ignore */ }
      voice.draw(offContext, stave)

      // Now use the actual canvas element we created above (canvasEl)
      if (!canvasEl) throw new Error("Offscreen canvas not found")

      // Prepare high-DPI scaling
      const ratio = window.devicePixelRatio || 1
      const svgWidth = canvasEl.width / ratio
      const svgHeight = canvasEl.height / ratio

      // Determine page width (A4-like) in CSS pixels
      const PAGE_PX = 794 // ~A4 width @96dpi
      const pageCount = Math.ceil(svgWidth / PAGE_PX)
      const pagesData: string[] = []

      // Create full-resolution offscreen canvas copy to slice from (to preserve DPI)
      const fullCanvas = document.createElement("canvas")
      fullCanvas.width = canvasEl.width
      fullCanvas.height = canvasEl.height
      const fullCtx = fullCanvas.getContext("2d")
      if (!fullCtx) throw new Error("2D context unavailable")
      fullCtx.fillStyle = "#fff"
      fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height)
      fullCtx.drawImage(canvasEl, 0, 0)

      for (let p = 0; p < pageCount; p++) {
        const sx = Math.round(p * PAGE_PX * ratio)
        const sWidthPx = Math.min(Math.round(PAGE_PX * ratio), fullCanvas.width - sx)
        const pageCanvas = document.createElement("canvas")
        pageCanvas.width = sWidthPx
        pageCanvas.height = fullCanvas.height
        const pageCtx = pageCanvas.getContext("2d")
        if (!pageCtx) throw new Error("2D context unavailable")
        pageCtx.fillStyle = "#fff"
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        pageCtx.drawImage(fullCanvas, sx, 0, sWidthPx, fullCanvas.height, 0, 0, sWidthPx, fullCanvas.height)
        pagesData.push(pageCanvas.toDataURL("image/png"))
      }

      // Load jsPDF and assemble PDF
      const loadJsPdf = (): Promise<any> => {
        if ((window as any).jspdf && (window as any).jspdf.jsPDF) return Promise.resolve((window as any).jspdf)
        return new Promise((resolve, reject) => {
          const src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
          const existing = document.querySelector(`script[src="${src}"]`)
          if (existing) {
            const check = () => {
              if ((window as any).jspdf && (window as any).jspdf.jsPDF) resolve((window as any).jspdf)
              else setTimeout(check, 50)
            }
            check()
            return
          }
          const s = document.createElement("script")
          s.src = src
          s.onload = () => {
            if ((window as any).jspdf && (window as any).jspdf.jsPDF) resolve((window as any).jspdf)
            else reject(new Error("jsPDF failed to load"))
          }
          s.onerror = () => reject(new Error("Failed to load jsPDF"))
          document.head.appendChild(s)
        })
      }

      const jspdf = await loadJsPdf()
      const { jsPDF } = jspdf
      const PX_TO_MM = 0.264583333

      let doc: any = null
      for (let i = 0; i < pagesData.length; i++) {
        const dataUrl = pagesData[i]
        const image = new Image()
        image.src = dataUrl
        await new Promise<void>((res) => { image.onload = () => res(); image.onerror = () => res() })
        const iw = image.width
        const ih = image.height
        const mmW = Math.max(1, iw * PX_TO_MM)
        const mmH = Math.max(1, ih * PX_TO_MM)

        if (i === 0) {
          doc = new jsPDF({ unit: "mm", format: [mmW, mmH], orientation: mmW > mmH ? "landscape" : "portrait" })
          doc.addImage(dataUrl, "PNG", 0, 0, mmW, mmH)
        } else {
          doc.addPage([mmW, mmH], mmW > mmH ? "landscape" : "portrait")
          doc.addImage(dataUrl, "PNG", 0, 0, mmW, mmH)
        }
      }

      if (doc) doc.save("tabs.pdf")
      else {
        const a = document.createElement("a")
        a.href = pagesData[0]
        a.download = "tab-page-1.png"
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
    } catch (err) {
      console.error("Export PDF failed:", err)
    } finally {
      // cleanup
      if (off && off.parentNode) document.body.removeChild(off)
    }
  }

  return (
    <div className="w-full">
      {/* Controls row: navigation on left, export buttons on right (same y-level) */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={handlePrevClick} className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600">◀ Prev</button>
          <button onClick={handleNextClick} className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600">Next ▶</button>
          <button onClick={() => clearTabs()} className="px-3 py-1 bg-red-700 text-white rounded hover:bg-red-600">Clear Tabs</button>
          <div className="text-sm text-slate-300 ml-2">
            Slot {caretIndex + 1} / {Math.max(1, slotsRef.current.length)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMusicXML}
            className="px-3 py-1 bg-purple-700 text-white rounded hover:bg-purple-600"
          >
            Export MusicXML
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3 py-1 bg-indigo-700 text-white rounded hover:bg-indigo-600"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className={"bg-white"} ref={containerRef} style={{ width: "100%", overflowX: "auto", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 6, padding: 6 }}>
        <div style={{ minWidth: "400px" }} aria-hidden />
      </div>
    </div>
  )
}