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

  // Export MusicXML from current tab slots (pretty-printed with newlines)
  const handleExportMusicXML = () => {
    const indent = (level: number) => "  ".repeat(level)

    function fretPosToNoteXml(pos: { str: number; fret: number }, level: number) {
      const stringNum = pos.str + 1 // 1..6
      const fretNum = pos.fret
      const midi = 40 + (6 - stringNum) * 5 + fretNum
      const stepArr = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
      const step = stepArr[midi % 12]
      const octave = Math.floor(midi / 12) - 1

      const lines = [
        `${indent(level)}<note>`,
        `${indent(level+1)}<pitch>`,
        `${indent(level+2)}<step>${step.replace("#","")}</step>`,
        step.includes("#") ? `${indent(level+2)}<alter>1</alter>` : null,
        `${indent(level+2)}<octave>${octave}</octave>`,
        `${indent(level+1)}</pitch>`,
        `${indent(level+1)}<duration>1</duration>`,
        `${indent(level+1)}<notations>`,
        `${indent(level+2)}<technical>`,
        `${indent(level+3)}<string>${stringNum}</string>`,
        `${indent(level+3)}<fret>${fretNum}</fret>`,
        `${indent(level+2)}</technical>`,
        `${indent(level+1)}</notations>`,
        `${indent(level)}</note>`,
      ].filter(Boolean as any)
      return lines.join("\n")
    }

    const measuresLines: string[] = []
    slotsRef.current.forEach((slot, idx) => {
      measuresLines.push(`${indent(2)}<measure number="${idx+1}">`)
      if (slot.positions && slot.positions.length > 0) {
        slot.positions.forEach(p => {
          measuresLines.push(fretPosToNoteXml(p, 3))
        })
      } else {
        measuresLines.push(`${indent(3)}<note>`)
        measuresLines.push(`${indent(4)}<rest/>`)
        measuresLines.push(`${indent(4)}<duration>1</duration>`)
        measuresLines.push(`${indent(3)}</note>`)
      }
      measuresLines.push(`${indent(2)}</measure>`)
    })

    const xmlLines = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<!DOCTYPE score-partwise PUBLIC`,
      `  "-//Recordare//DTD MusicXML 3.1 Partwise//EN"`,
      `  "http://www.musicxml.org/dtds/partwise.dtd">`,
      `<score-partwise version="3.1">`,
      `${indent(1)}<part-list>`,
      `${indent(2)}<score-part id="P1">`,
      `${indent(3)}<part-name>Guitar Tab</part-name>`,
      `${indent(2)}</score-part>`,
      `${indent(1)}</part-list>`,
      `${indent(1)}<part id="P1">`,
      ...measuresLines,
      `${indent(1)}</part>`,
      `</score-partwise>`
    ]

    const musicXml = xmlLines.join("\n")

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
  };

  // Export PNG/PDF: create multi-page images and export a real PDF file (automatic download)
  const loadJsPdf = (): Promise<any> => {
    if ((window as any).jspdf && (window as any).jspdf.jsPDF) return Promise.resolve((window as any).jspdf);
    return new Promise((resolve, reject) => {
      const src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        const check = () => {
          if ((window as any).jspdf && (window as any).jspdf.jsPDF) resolve((window as any).jspdf);
          else setTimeout(check, 50);
        };
        check();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => {
        if ((window as any).jspdf && (window as any).jspdf.jsPDF) resolve((window as any).jspdf);
        else reject(new Error("jsPDF failed to load"));
      };
      s.onerror = () => reject(new Error("Failed to load jsPDF script"));
      document.head.appendChild(s);
    });
  };

  const handleExportPDF = async () => {
    const svgEl = containerRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgEl);
    if (!svgString.match(/^<svg[^>]+xmlns=/)) {
      svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const ratio = window.devicePixelRatio || 1;
        const svgWidth = img.width;
        const svgHeight = img.height;

        // Page width (px) to slice horizontally — A4-like width in px at 96dpi (~794px)
        const PAGE_PX = 794;
        const pageWidthPx = PAGE_PX;
        const pageCount = Math.ceil(svgWidth / pageWidthPx);

        // Draw full svg into high-dpi canvas
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = Math.max(1, Math.round(svgWidth * ratio));
        fullCanvas.height = Math.max(1, Math.round(svgHeight * ratio));
        const fullCtx = fullCanvas.getContext("2d");
        if (!fullCtx) throw new Error("Canvas context unavailable");
        fullCtx.fillStyle = "#ffffff";
        fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
        fullCtx.drawImage(img, 0, 0, fullCanvas.width, fullCanvas.height);

        // Produce page images (PNG data URLs)
        const pagesData: string[] = [];
        for (let p = 0; p < pageCount; p++) {
          const sx = p * pageWidthPx;
          const sWidth = Math.min(pageWidthPx, svgWidth - sx);
          const canvasPage = document.createElement("canvas");
          canvasPage.width = Math.max(1, Math.round(sWidth * ratio));
          canvasPage.height = fullCanvas.height;
          const ctx = canvasPage.getContext("2d");
          if (!ctx) throw new Error("Canvas context unavailable");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvasPage.width, canvasPage.height);
          ctx.drawImage(
            fullCanvas,
            Math.round(sx * ratio), 0,
            Math.round(sWidth * ratio), fullCanvas.height,
            0, 0,
            Math.round(sWidth * ratio), fullCanvas.height
          );
          pagesData.push(canvasPage.toDataURL("image/png"));
        }

        // Load jsPDF dynamically
        const jspdf = await loadJsPdf();
        const { jsPDF } = jspdf;

        // Create PDF and add pages
        // Convert px -> mm (1 px @ 96dpi = 0.264583333 mm)
        const PX_TO_MM = 0.264583333;
        let doc: any = null;
        for (let i = 0; i < pagesData.length; i++) {
          const dataUrl = pagesData[i];
          // Create an Image to read dimensions (we already have sWidth/sizes, but use canvas)
          const image = new Image();
          image.src = dataUrl;
          // Wait for image (should be cached)
          await new Promise<void>((res) => {
            image.onload = () => res();
            image.onerror = () => res();
          });
          const iw = image.width;
          const ih = image.height;
          const mmW = Math.max(1, iw * PX_TO_MM);
          const mmH = Math.max(1, ih * PX_TO_MM);

          if (i === 0) {
            // create doc with size matching first page
            doc = new jsPDF({
              unit: "mm",
              format: [mmW, mmH],
              orientation: mmW > mmH ? "landscape" : "portrait",
            });
            doc.addImage(dataUrl, "PNG", 0, 0, mmW, mmH);
          } else {
            doc.addPage([mmW, mmH], mmW > mmH ? "landscape" : "portrait");
            doc.addImage(dataUrl, "PNG", 0, 0, mmW, mmH);
          }
        }

        if (doc) {
          doc.save("tabs.pdf");
        } else {
          // fallback: download first PNG
          const a = document.createElement("a");
          a.href = pagesData[0];
          a.download = "tab-page-1.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } catch (err) {
        console.error("Export PDF failed:", err);
      }
    };
    img.onerror = () => {
      console.error("Failed to load serialized SVG as image");
    };
    img.src = svgDataUrl;
  };

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
