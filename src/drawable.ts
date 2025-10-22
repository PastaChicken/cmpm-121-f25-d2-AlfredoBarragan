export type Point = { x: number; y: number; t: number };

export interface Drawable {
  draw(ctx: CanvasRenderingContext2D): void;
}

export class DrawableClass implements Drawable {
  private strokes: Point[][] = [];
  private redoStacks: Point[][] = [];
  private currentStroke: Point[] | null = null;

  begin(x: number, y: number) {
    this.currentStroke = [];
    const p: Point = { x, y, t: Date.now() };
    this.currentStroke.push(p);
    this.strokes.push(this.currentStroke);
    //starting a new stroke invalidates redo?
    this.redoStacks.length = 0;
  }

  drag(x: number, y: number) {
    if (!this.currentStroke) return;
    const p: Point = { x, y, t: Date.now() };
    this.currentStroke.push(p);
  }

  end() {
    this.currentStroke = null;
  }

  undo() {
    if (this.strokes.length === 0) return;
    const last = this.strokes.pop()!;
    this.redoStacks.push(last);
  }

  redo() {
    if (this.redoStacks.length === 0) return;
    const restored = this.redoStacks.pop()!;
    this.strokes.push(restored);
  }

  clear() {
    this.strokes.length = 0;
    this.currentStroke = null;
  }

  strokeCount() {
    return this.strokes.length;
  }

  redoCount() {
    return this.redoStacks.length;
  }

  strokeLengths() {
    return this.strokes.map((s) => s.length);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!ctx) return;

    for (const stroke of this.strokes) {
      if (!stroke || stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
      ctx.closePath();
    }
  }
}
