# Fretly

Fretly is a browser-based music practice and visualization app built with **Next.js**. It combines an interactive **piano**, an interactive **guitar fretboard**, a **tab renderer**, and a **score viewer** so you can explore notes/chords across different instrument and notation views.

## What this project does

https://github.com/user-attachments/assets/a969309d-0132-4841-963a-a45c277b56f7


On the home page (`src/app/page.tsx`), Fretly brings together four main experiences:

- **Piano** (`src/components/Piano.tsx`): play notes and build/play chords using your mouse/keyboard with audio powered by Tone.js.
- **Guitar fretboard** (`src/components/Fretboard.tsx`): click frets/strings to select notes, highlight positions, and play guitar samples.
- **Tab rendering + navigation** (`src/components/TabRenderer.tsx`): render guitar tablature from selected positions and navigate through tab “slots”; navigation can drive fretboard highlights and playback.
- **Score viewer** (`src/components/ScoreViewer.tsx`): upload/view sheet music (MusicXML) and navigate a playback cursor; the current notes can be played as you step through the score.

In practice, this means you can:

- Select notes on the fretboard and see them reflected in tab.
- Navigate through tab and have the fretboard highlight/play the corresponding positions.
- Load a score and step through it while hearing the notes.

## Tech stack

### Core framework

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**

### Styling / UI

- **Tailwind CSS**
- Utility helpers: `clsx`, `tailwind-merge`, `class-variance-authority`
- **Radix UI** (`@radix-ui/react-slot`) for composable UI primitives
- Icons: `lucide-react`

### State management

- **Zustand** (`src/store/store.ts`) for shared app state and cross-component callbacks (navigation + playback).

### Music / audio / notation

- **Tone.js** (`tone`) for browser audio playback
  - Guitar playback uses a **sample-based** `Tone.Sampler` (see `src/components/Fretboard.tsx`).
- **@tonaljs/tonal** for music theory utilities (notes/chords/scales)
- **VexFlow v5** (`vexflow`) for notation/tab rendering support
- **OpenSheetMusicDisplay** (`opensheetmusicdisplay`) for MusicXML score viewing + cursor navigation
- Chord/diagram libs: `@tombatossals/react-chords`, `react-guitar-chords`

### Misc

- **Vercel Analytics** (`@vercel/analytics`)

## Getting Started

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

```bash
npm run dev     # Start Next.js dev server (Turbopack)
npm run build   # Build (Turbopack)
npm run start   # Start production server
npm run lint    # Run ESLint
```

- https://nextjs.org/docs/app/building-your-application/deploying

---

If you want, tell me the intended “one-liner” for Fretly (e.g., *"a guitar/tab/score practice tool"*) and I’ll tighten the intro + feature list to match your exact vision.
