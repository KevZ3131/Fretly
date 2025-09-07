declare module "vexflow/build/esm/entry/vexflow.js" {
  export class Renderer {
    static Backends: { SVG: number; CANVAS: number };
    constructor(element: HTMLElement, backend: number);
    getContext(): any;
    resize(width: number, height: number): void;
  }

  export class TabStave {
    constructor(x: number, y: number, width: number);
    addTabGlyph(): void;
    setContext(context: any): this;
    draw(): this;
  }

  export class TabNote {
    constructor(opts: { positions: { str: number; fret: number }[]; duration: string });
  }

  export class Voice {
    constructor(time: { num_beats: number; beat_value: number });
    addTickables(notes: any[]): this;
    draw(context: any, stave: any): void;
  }

  export class Formatter {
    joinVoices(voices: any[]): this;
    format(voices: any[], width: number): this;
  }
}
