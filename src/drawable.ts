export type Point = { x: number; y: number; t: number };

export interface Drawable {
  draw(ctx: CanvasRenderingContext2D): void;
}

type Stroke = {
  points: Point[];
  width: number;
  color?: string;
};

export class DrawableClass implements Drawable {
  private strokes: Stroke[] = [];
  private redoStacks: Stroke[] = [];
  private currentStroke: Stroke | null = null;
  private currentWidth = 1;
  private currentColor = "#000";

  setStrokeWidth(w: number) {
    this.currentWidth = Math.max(1, Math.round(w));
  }

  getStrokeWidth() {
    return this.currentWidth;
  }

  begin(x: number, y: number) {
    this.currentStroke = {
      points: [{ x, y, t: Date.now() }],
      width: this.currentWidth,
      color: this.currentColor,
    };
    this.strokes.push(this.currentStroke);
    this.redoStacks.length = 0; // Clear redo stack on new stroke
  }

  drag(x: number, y: number) {
    if (!this.currentStroke) return;
    this.currentStroke.points.push({ x, y, t: Date.now() });
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
    return this.strokes.map((s) => s.points.length);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const stroke of this.strokes) {
      if (!stroke || stroke.points.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.strokeStyle = stroke.color ?? "#000";
      ctx.lineWidth = stroke.width;
      ctx.stroke();
      ctx.closePath();
    }
  }
}
