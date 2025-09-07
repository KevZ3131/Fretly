"use client"

import { useRef, useState } from "react"
// @ts-ignore
import OpenSheetMusicDisplay from "opensheetmusicdisplay"
import { unzipSync, strFromU8 } from "fflate"

export default function ScoreViewer() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const tabOutputRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<any>(null)
  const musicIdxRef = useRef<number>(0)
  const tabsRef = useRef<any[]>([])

  // Dummy updateCursor function
  function updateCursor() {
    // You can implement custom cursor logic here if needed
  }

  async function uploadFile() {
    const fileSource = fileInputRef.current
    const file = fileSource?.files?.[0]
    if (!file) return

    setError(null)
    setLoading(true)

    try {
      // Initialize OSMD first with basic options
      if (!osmdRef.current && outputRef.current) {
        try {
          const OSMD = (OpenSheetMusicDisplay as any).OpenSheetMusicDisplay || OpenSheetMusicDisplay
          osmdRef.current = new OSMD(outputRef.current)
          // Set options after successful initialization
          osmdRef.current.setOptions({
            autoResize: true,
            drawingParameters: "compacttight",
            drawTitle: false,
            renderSingleHorizontalStaffline: true
          })
        } catch (initErr) {
          console.error("OSMD initialization error:", initErr)
          throw new Error("Failed to initialize score viewer")
        }
      }

      // Clear previous content
      if (outputRef.current) {
        outputRef.current.innerHTML = ''
      }

      const reader = new FileReader()
      reader.onload = async function () {
        try {
          let xmlString: string | null = null
          if (file.name.endsWith(".mxl")) {
            const uint8 = new Uint8Array(reader.result as ArrayBuffer)
            const files = unzipSync(uint8)
            console.log("MXL contents:", Object.keys(files)) // Debug log

            // Try each XML file until one works
            for (const fileName of Object.keys(files)) {
              if (fileName.endsWith(".xml")) {
                try {
                  xmlString = strFromU8(files[fileName])
                  await osmdRef.current.load(xmlString)
                  console.log("Successfully loaded:", fileName)
                  break
                } catch (loadErr) {
                  console.log("Failed to load:", fileName, loadErr)
                  continue
                }
              }
            }
            if (!xmlString) {
              throw new Error("No valid XML file found in archive")
            }
          } else {
            xmlString = reader.result as string
            await osmdRef.current.load(xmlString)
          }

          osmdRef.current.render()
          osmdRef.current.cursor.show()
          updateCursor()
          setLoading(false)
        } catch (err) {
          console.error("Score loading error:", err)
          throw err
        }
      }

      reader.onerror = () => {
        setError("Could not read file.")
        setLoading(false)
      }

      if (file.name.endsWith(".mxl")) {
        reader.readAsArrayBuffer(file)
      } else {
        reader.readAsText(file)
      }

    } catch (err: any) {
      console.error("Full error:", err)
      setError(`Failed to load score: ${err.message || "Unknown error"}`)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <h2 className="text-xl font-bold mb-4 text-white">Upload MusicXML and View Score</h2>
      <input
        type="file"
        id="myFile"
        ref={fileInputRef}
        accept=".xml,.musicxml,.mxl"
        className="mb-4 block"
      />
      <button
        onClick={uploadFile}
        className="px-4 py-2 bg-blue-700 text-white rounded mb-4"
      >
        Upload and Render
      </button>
      {loading && (
        <div className="text-blue-400 mb-2">Loading and rendering score...</div>
      )}
      {error && (
        <div className="text-red-500 mb-2">{error}</div>
      )}
      <div
        id="output"
        ref={outputRef}
        className="bg-white rounded shadow p-2 overflow-auto"
        style={{ minHeight: 300, minWidth: 300 }}
      />
      <div
        id="tabOutput"
        ref={tabOutputRef}
        className="bg-white rounded shadow p-2 overflow-auto mt-4"
        style={{ minHeight: 100, minWidth: 300 }}
      />
      <div className="flex gap-2 mt-2">
        <button
          id="goBack"
          className="px-3 py-1 bg-slate-700 text-white rounded"
        >
          ◀ Prev
        </button>
        <button
          id="goForward"
          className="px-3 py-1 bg-slate-700 text-white rounded"
        >
          Next ▶
        </button>
      </div>
    </div>
  )
}
