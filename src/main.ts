import "./style.css";

type Point = { x: number; y: number; t: number };

interface Drawable {
  draw(ctx: CanvasRenderingContext2D): void;
}

type Stroke = {
  points: Point[];
  width: number;
  color?: string;
};

type Sticker = {
  img: HTMLImageElement | string;
  x: number;
  y: number;
  w: number;
  h: number;
};

// Replace class with small factories for Drawable items
type StrokeDrawable = {
  type: "stroke";
  points: Point[];
  width: number;
  color?: string;
  draw(ctx: CanvasRenderingContext2D): void;
};

type TextDrawable = {
  type: "text";
  text: string;
  x: number;
  y: number;
  font?: string;
  color: string;
  draw(ctx: CanvasRenderingContext2D): void;
};

type StickerDrawable = {
  type: "sticker";
  img: HTMLImageElement | string;
  x: number;
  y: number;
  w: number;
  h: number;
  draw(ctx: CanvasRenderingContext2D): void;
};

function makeStrokeDrawable(width: number, color = "#000"): StrokeDrawable {
  const points: Point[] = [];
  const d: StrokeDrawable = {
    type: "stroke",
    points,
    width,
    color,
    draw(ctx: CanvasRenderingContext2D) {
      if (!points.length) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = d.color ?? "#000";
      ctx.lineWidth = d.width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.closePath();
    },
  };
  return d;
}

function _makeTextDrawable(
  text: string,
  x: number,
  y: number,
  font?: string,
  color = "#000",
): TextDrawable {
  const obj: Partial<TextDrawable> = {
    type: "text",
    text,
    x,
    y,
    color,
    draw(ctx: CanvasRenderingContext2D) {
      ctx.save();
      if (font) ctx.font = font;
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.fillText(text, x, y);
      ctx.restore();
    },
  };
  if (font !== undefined) obj.font = font;
  return obj as TextDrawable;
}

function isStrokeDrawable(d: Drawable): d is StrokeDrawable {
  return (d as unknown as { type?: string }).type === "stroke";
}

function makeStickerDrawable(
  img: HTMLImageElement | string,
  x: number,
  y: number,
  w = 48,
  h = 48,
): StickerDrawable {
  return {
    type: "sticker",
    img,
    x,
    y,
    w,
    h,
    draw(ctx: CanvasRenderingContext2D) {
      const dx = x - w / 2;
      const dy = y - h / 2;
      if (typeof img === "string") {
        if (img.startsWith("data:") || img.startsWith("http")) {
          const im = new Image();
          im.src = img;
          try {
            ctx.drawImage(im, dx, dy, w, h);
          } catch (_err) {
            // not ready yet
          }
        } else {
          ctx.save();
          ctx.font = `${h}px serif`;
          ctx.textBaseline = "middle";
          ctx.textAlign = "center";
          ctx.fillText(String(img), x, y);
          ctx.restore();
        }
      } else {
        try {
          ctx.drawImage(img, dx, dy, w, h);
        } catch (_err) {
          // not ready
        }
      }
    },
  };
}

// helper to draw all drawables
function drawAll() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const d of drawables) d.draw(context);
}

// pending drawables are user changes not yet committed to the visible canvas
const pendingDrawables: Drawable[] = [];

// push into pending (new uncommitted changes)
function pushPending(d: Drawable) {
  pendingDrawables.push(d);
  // notify UI (committed drawables unchanged)
  updateStrokesListUI();
}

// commit pending changes to visible drawables (called by DrawChanges)
function commitPending() {
  if (pendingDrawables.length === 0) return;
  // move pending into committed drawables, preserving order
  drawables.push(...pendingDrawables);
  pendingDrawables.length = 0;
  // new action invalidates redo history
  redoStack.length = 0;
  emitDrawingChanged();
  updateStrokesListUI();
}

function undoAction() {
  if (drawables.length === 0) return;
  const last = drawables.pop()!;
  redoStack.push(last);
  emitDrawingChanged();
  updateStrokesListUI();
}

function redoAction() {
  if (redoStack.length === 0) return;
  const restored = redoStack.pop()!;
  drawables.push(restored);
  emitDrawingChanged();
  updateStrokesListUI();
}

function clearAll() {
  drawables.length = 0;
  pendingDrawables.length = 0;
  redoStack.length = 0;
  emitDrawingChanged();
  updateStrokesListUI();
}

document.body.innerHTML = `
  <h1> Insert Title Here 1 </h1>
  <div style="display:flex;gap:12px;align-items:flex-start">
    <canvas id="canvaspad" class="canvas" width="256" height="256"></canvas>
    <div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <button id="thinner" type="button">-</button>
        <span id="thicknessDisplay">1</span>
        <button id="thicker" type="button">+</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <button id="toolDraw" type="button">Draw</button>
        <div id="stickerButtons" style="display:flex;gap:6px"></div>
      </div>
      <div id="strokesList" aria-live="polite">Strokes: 0</div>
    </div>
  </div>
  <button id="drawChanges" type="button">DrawChanges</button>
  <button id="clearBtn" type="button">Clear</button>
  <button id="undoBtn" type="button">Undo</button>
  <button id="redoBtn" type="button">Redo</button> 

`;

const canvas = document.getElementById("canvaspad") as HTMLCanvasElement;
const context = canvas.getContext("2d")!;

// --- New non-class-based drawable model ---
// drawables array holds all placed items (strokes, text, stickers)
const drawables: Drawable[] = [];
const redoStack: Drawable[] = [];

// keep a reference to the item being drawn (a stroke drawable)
let currentDrawable: Drawable | null = null;

// simple stroke width state (replaces DrawableObj.get/set)
let currentStrokeWidth = 1;
function setStrokeWidth(w: number) {
  currentStrokeWidth = Math.max(1, Math.round(w));
}
function getStrokeWidth() {
  return currentStrokeWidth;
}

// initalize all variables used for UI
const strokesList = document.getElementById("strokesList") as HTMLUListElement;
const undoBtn = document.getElementById("undoBtn") as HTMLButtonElement;
const redoBtn = document.getElementById("redoBtn") as HTMLButtonElement;
const drawChangesBtn = document.getElementById(
  "drawChanges",
) as HTMLButtonElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
const thicknessDisplay = document.getElementById(
  "thicknessDisplay",
) as HTMLSpanElement;
const thickerBtn = document.getElementById("thicker") as HTMLButtonElement;
const thinnerBtn = document.getElementById("thinner") as HTMLButtonElement;
// Stickers are defined in one place below and used to generate buttons/UI
const toolDrawBtn = document.getElementById("toolDraw") as HTMLButtonElement;
//for tool preview
const HOVER_EMIT_INTERVAL = 100; // ms
let isHovering = false;
let lastHoverEmit = 0;
let hoverX = 0;
let hoverY = 0;
// stickers definition — single source of truth for available stickers
const STICKERS = [
  { id: "stickerA", label: "🍕", size: 48 },
  { id: "stickerB", label: "🍝", size: 48 },
  { id: "stickerC", label: "🥖", size: 48 },
] as const;

let currentTool: string = "draw";

function updateThicknessUI() {
  if (!thicknessDisplay) return;
  thicknessDisplay.textContent = String(getStrokeWidth());
}

// Set drawing properties

function emitDrawingChanged() {
  const event = new Event("drawingChanged");
  canvas.dispatchEvent(event);
}

function updateStrokesListUI() {
  if (!strokesList) return;
  // compute stroke info from drawables array
  const strokeLengths = drawables.filter(isStrokeDrawable).map((s) =>
    s.points.length
  );
  const breakdown = strokeLengths.join(", ") || "none";
  strokesList.textContent =
    `Strokes: ${strokeLengths.length} | Redo: ${redoStack.length} | lengths: ${breakdown}`;
}

function emitOnHoveringInCanvas(x?: number, y?: number, inside = false) {
  const event = new CustomEvent("hoveringInCanvas", {
    detail: { x, y, inside },
  });
  canvas.dispatchEvent(event);
}

// Draw function with hover preview
function drawAndPreview() {
  // draw existing items
  drawAll();

  // draw hover preview only when pointer is inside the canvas
  if (!isHovering) return;

  if (currentTool === "draw") {
    const w = Math.max(1, getStrokeWidth());
    const r = w / 2;

    context.save();
    context.beginPath();
    context.fillStyle = "rgba(0,0,0,0.12)"; // faint fill
    context.strokeStyle = "rgba(0,0,0,0.5)"; // faint outline
    context.lineWidth = 1;
    context.arc(hoverX, hoverY, r, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.closePath();
    context.restore();
  } else {
    // if a sticker tool is selected, show its label as a preview
    const sticker = STICKERS.find((x) => x.id === currentTool);
    if (sticker) {
      context.font = `${Math.max(16, sticker.size / 2)}px sans-serif`;
      context.fillText(
        sticker.label,
        hoverX - sticker.size / 4,
        hoverY + sticker.size / 4,
      );
    }
  }
}

// Canvas mouse event listeners
canvas.addEventListener("mousedown", (e) => {
  // start a new stroke or place a sticker based on the current tool
  if (currentTool === "draw") {
    const stroke = makeStrokeDrawable(getStrokeWidth());
    stroke.points.push({ x: e.offsetX, y: e.offsetY, t: Date.now() });
    pushPending(stroke);
    currentDrawable = stroke;
    return;
  }

  // sticker placement
  // sticker placement — look up sticker by id in STICKERS
  const sticker = STICKERS.find((s) => s.id === currentTool);
  if (sticker) {
    const s = makeStickerDrawable(
      sticker.label,
      e.offsetX,
      e.offsetY,
      sticker.size,
      sticker.size,
    );
    pushPending(s);
    drawAndPreview();
    return;
  }
});

canvas.addEventListener("mouseup", (_e) => {
  // finish current stroke
  currentDrawable = null;
});

canvas.addEventListener("mousemove", (e) => {
  if (currentDrawable && isStrokeDrawable(currentDrawable)) {
    const stroke = currentDrawable as StrokeDrawable;
    stroke.points.push({ x: e.offsetX, y: e.offsetY, t: Date.now() });
    drawAndPreview();
    updateStrokesListUI();
  }
});

canvas.addEventListener("drawingChanged", (_ev) => {
  drawAndPreview();
});

canvas.addEventListener("hoveringInCanvas", (_ev) => {
  // Placeholder for hover-related functionality
  const detail = (_ev as CustomEvent).detail as {
    x?: number;
    y?: number;
    inside: boolean;
  };
  if (detail.x !== undefined && detail.y !== undefined) {
    hoverX = detail.x;
    hoverY = detail.y;
  }
  isHovering = !!detail.inside;
  // For example, you could show a preview of the brush at (detail.hoverX, detail.hoverY)
  drawAndPreview();
});

canvas.addEventListener("pointerenter", (e) => {
  isHovering = true;
  hoverX = e.offsetX;
  hoverY = e.offsetY;
  drawAndPreview();
  emitOnHoveringInCanvas(hoverX, hoverY, true);
});

canvas.addEventListener("pointerleave", (_e) => {
  isHovering = false;
  drawAndPreview();
  emitOnHoveringInCanvas(undefined, undefined, false);
});

canvas.addEventListener("pointermove", (e) => {
  hoverX = e.offsetX;
  hoverY = e.offsetY;
  drawAndPreview();
  const now = Date.now();
  if (now - lastHoverEmit > HOVER_EMIT_INTERVAL) {
    lastHoverEmit = now;
    emitOnHoveringInCanvas(hoverX, hoverY, true);
  }
});

// Button event listeners

// DrawChanges commits pending changes to the visible canvas
drawChangesBtn.addEventListener("click", () => {
  commitPending();
});

clearBtn.addEventListener("click", () => clearAll());

undoBtn.addEventListener("click", () => undoAction());

redoBtn.addEventListener("click", () => redoAction());

toolDrawBtn.addEventListener("click", () => {
  currentTool = "draw";
  toolDrawBtn.disabled = true;
});

// populate sticker buttons from STICKERS array
const stickerContainer = document.getElementById("stickerButtons");
if (stickerContainer) {
  for (const s of STICKERS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = s.id;
    btn.textContent = s.label;
    btn.title = s.label;
    btn.addEventListener("click", () => {
      currentTool = s.id;
      toolDrawBtn.disabled = false;
      emitDrawingChanged();
      updateStrokesListUI();
    });
    stickerContainer.appendChild(btn);
  }
}

updateThicknessUI();

thickerBtn.addEventListener("click", () => {
  console.log("thicker clicked, before:", getStrokeWidth());
  setStrokeWidth(getStrokeWidth() + 1);
  console.log("after set:", getStrokeWidth());
  updateThicknessUI();
  drawAndPreview();
  updateStrokesListUI();
});

thinnerBtn.addEventListener("click", () => {
  console.log("thinner clicked, before:", getStrokeWidth());
  setStrokeWidth(Math.max(1, getStrokeWidth() - 1));
  console.log("after set:", getStrokeWidth());
  updateThicknessUI();
  drawAndPreview();
  updateStrokesListUI();
});
