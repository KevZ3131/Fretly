'use client'
import React, { useEffect, useRef, useState, useCallback } from "react"
// Force import from v5’s ESM entry
// @ts-ignore
import { Renderer, TabStave, TabNote, Voice, Formatter } from "vexflow"
import { useCaretIndex, useStore } from "@/store/store"

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

    const voice = new Voice({ num_beats: 4, beat_value: 4 })

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

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-2">
        <button onClick={handlePrevClick} className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600">◀ Prev</button>
        <button onClick={handleNextClick} className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600">Next ▶</button>
        <button onClick={() => clearTabs()} className="px-3 py-1 bg-red-700 text-white rounded hover:bg-red-600">Clear Tabs</button>
        <div className="text-sm text-slate-300 ml-2">
          Slot {caretIndex + 1} / {Math.max(1, slotsRef.current.length)}
        </div>
      </div>
      <div className={"bg-white"} ref={containerRef} style={{ width: "100%", overflowX: "auto", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 6, padding: 6 }}>
        <div style={{ minWidth: "400px" }} aria-hidden />
      </div>
    </div>
  )
}
