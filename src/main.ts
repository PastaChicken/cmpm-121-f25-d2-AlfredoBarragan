import "./style.css";

type Point = { x: number; y: number; t: number };

// Named constants to remove magic numbers
const CANVAS_INITIAL_SIZE = 256;
const DEFAULT_STROKE_WIDTH = 1;
const MIN_STROKE_WIDTH = 1;
const DEFAULT_STROKE_COLOR = "#000000";
const DEFAULT_STICKER_SIZE = 48;
const STICKER_MIN_SIZE = 8;
const STICKER_MAX_SIZE = 256;
const EXPORT_CANVAS_SIZE = 1024;
const MIN_STICKER_PREVIEW_FONT = 16;
const PREVIEW_STROKE_WIDTH = 1;
const HOVER_FILL_ALPHA = 0.12;
const HOVER_STROKE_ALPHA = 0.5;

// Event name constants
const EVENT_DRAWING_CHANGED = "drawing-changed" as const;
const EVENT_HOVERING_IN_CANVAS = "hoveringInCanvas" as const;

// Typed event detail for hover events
// Use explicit `number | undefined` so assignments from optional params type-check
type HoveringInCanvasDetail = {
  x: number | undefined;
  y: number | undefined;
  inside: boolean;
};

interface Drawable {
  draw(ctx: CanvasRenderingContext2D): void;
}

// Replace class with small factories for Drawable items
type StrokeDrawable = {
  type: "stroke";
  points: Point[];
  width: number;
  color?: string;
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

function isStrokeDrawable(d: Drawable): d is StrokeDrawable {
  return (d as unknown as { type?: string }).type === "stroke";
}

function makeStickerDrawable(
  img: HTMLImageElement | string,
  x: number,
  y: number,
  w = DEFAULT_STICKER_SIZE,
  h = DEFAULT_STICKER_SIZE,
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

// push directly into the committed drawables
function pushPending(d: Drawable) {
  // add new drawable immediately
  drawables.push(d);
  // new action invalidates redo history
  redoStack.length = 0;
  // notify UI and redraw
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
  redoStack.length = 0;
  emitDrawingChanged();
  updateStrokesListUI();
}

document.body.innerHTML = `
  <h1> Insert Title Here 1 </h1>
  <div class="app-row">
    <canvas id="canvaspad" class="canvas" width="${CANVAS_INITIAL_SIZE}" height="${CANVAS_INITIAL_SIZE}"></canvas>
    <div class="control-panel">
      <div class="controls-row thickness-row">
        <button id="thinner" type="button" class="control-button">-</button>
        <span id="thicknessDisplay" class="thickness-display">${DEFAULT_STROKE_WIDTH}</span>
        <button id="thicker" type="button" class="control-button">+</button>
      </div>
        <div class="controls-row tool-row">
        <button id="toolDraw" type="button" class="control-button">Draw</button>
        <div id="stickerButtons" class="sticker-buttons"></div>
        <button id="addStickerBtn" type="button" title="Add custom sticker" class="control-button">+Sticker</button>
      </div>
      <div class="controls-row" id="rgbControls">
        <label for="sliderR">R</label>
        <input id="sliderR" type="range" min="0" max="255" value="0">
        <label for="sliderG">G</label>
        <input id="sliderG" type="range" min="0" max="255" value="0">
        <label for="sliderB">B</label>
        <input id="sliderB" type="range" min="0" max="255" value="0">
        <div id="colorSwatch" title="Brush color preview" style="width:28px;height:28px;border:1px solid #ccc;margin-left:8px;background:${DEFAULT_STROKE_COLOR};"></div>
      </div>
      <div id="strokesList" class="strokes-list" aria-live="polite">Strokes: 0</div>
    </div>
  </div>
  <div class="action-buttons-row">
    <button id="exportBtn" type="button" class="control-button">Export</button>
    <button id="clearBtn" type="button" class="control-button">Clear</button>
    <button id="undoBtn" type="button" class="control-button">Undo</button>
    <button id="redoBtn" type="button" class="control-button">Redo</button>
  </div>
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
let currentStrokeWidth = DEFAULT_STROKE_WIDTH;
let currentStrokeColor = DEFAULT_STROKE_COLOR;
function setStrokeColor(c: string) {
  currentStrokeColor = c;
}
function setStrokeWidth(w: number) {
  currentStrokeWidth = Math.max(MIN_STROKE_WIDTH, Math.round(w));
}
function getStrokeWidth() {
  return currentStrokeWidth;
}

// initalize all variables used for UI
const strokesList = document.getElementById("strokesList") as HTMLUListElement;
const undoBtn = document.getElementById("undoBtn") as HTMLButtonElement;
const redoBtn = document.getElementById("redoBtn") as HTMLButtonElement;
// drawChanges button removed; drawing commits immediately as clarified by TA
const exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
const thicknessDisplay = document.getElementById(
  "thicknessDisplay",
) as HTMLSpanElement;
const thickerBtn = document.getElementById("thicker") as HTMLButtonElement;
const thinnerBtn = document.getElementById("thinner") as HTMLButtonElement;
// Stickers are defined in one place below and used to generate buttons/UI
const toolDrawBtn = document.getElementById("toolDraw") as HTMLButtonElement;
// RGB sliders and swatch (replace the color input)
const sliderR = document.getElementById("sliderR") as HTMLInputElement | null;
const sliderG = document.getElementById("sliderG") as HTMLInputElement | null;
const sliderB = document.getElementById("sliderB") as HTMLInputElement | null;
const colorSwatch = document.getElementById("colorSwatch") as
  | HTMLDivElement
  | null;
//for tool preview
const HOVER_EMIT_INTERVAL = 100; // ms
let isHovering = false;
let lastHoverEmit = 0;
let hoverX = 0;
let hoverY = 0;
// stickers definition — single source of truth for available stickers
const STICKERS: { id: string; label: string; size: number }[] = [
  { id: "stickerA", label: "🍕", size: 48 },
  { id: "stickerB", label: "🍝", size: 48 },
  { id: "stickerC", label: "🥖", size: 48 },
];

let currentTool: string = "draw";

function updateThicknessUI() {
  if (!thicknessDisplay) return;
  thicknessDisplay.textContent = String(getStrokeWidth());
}

// RGB helpers and updater moved to module root so they can be reused elsewhere
const toHex = (n: number) => {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  const s = v.toString(16);
  return s.length === 1 ? "0" + s : s;
};
const rgbToHex = (r: number, g: number, b: number) =>
  `#${toHex(r)}${toHex(g)}${toHex(b)}`;

function updateColorFromSliders() {
  const r = sliderR ? Number(sliderR.value) : 0;
  const g = sliderG ? Number(sliderG.value) : 0;
  const b = sliderB ? Number(sliderB.value) : 0;
  const hex = rgbToHex(r, g, b);
  setStrokeColor(hex);
  if (colorSwatch) colorSwatch.style.background = hex;
  drawAndPreview();
}

// Set drawing properties

function emitDrawingChanged() {
  // Dispatch a typed CustomEvent (no detail payload)
  const event = new CustomEvent<void>(EVENT_DRAWING_CHANGED);
  canvas.dispatchEvent(event);
}

// Redraw committed drawables and any pending (in-progress) drawables
function redrawCommittedAndPending() {
  // clear canvas
  context.clearRect(0, 0, canvas.width, canvas.height);
  // draw committed
  for (const d of drawables) {
    try {
      d.draw(context);
    } catch (_err) {
      // ignore per-item draw errors
    }
  }
  // no pending buffer; drawables contains all visible items
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
  const detail: HoveringInCanvasDetail = { x, y, inside };
  const event = new CustomEvent<HoveringInCanvasDetail>(
    EVENT_HOVERING_IN_CANVAS,
    { detail },
  );
  canvas.dispatchEvent(event);
}

// Export current committed drawables to a 1024x1024 PNG file.
function exportDisplayAsPNG() {
  const off = document.createElement("canvas");
  off.width = EXPORT_CANVAS_SIZE;
  off.height = EXPORT_CANVAS_SIZE;
  const ctx = off.getContext("2d");
  if (!ctx) return;

  // Clear and prepare scaling so existing drawing commands (designed for
  // the on-screen canvas size) fill the larger canvas.
  ctx.clearRect(0, 0, off.width, off.height);
  const scale = off.width / canvas.width;
  ctx.save();
  ctx.scale(scale, scale);

  // Draw only committed drawables
  for (const d of drawables) {
    try {
      d.draw(ctx);
    } catch (_err) {
      // ignore drawing errors per-item to avoid aborting export
    }
  }

  ctx.restore();

  // Trigger download as PNG
  const dataUrl = off.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "High-Resolution-Export.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Draw function with hover preview
function drawAndPreview() {
  // draw existing items
  drawAll();

  // draw hover preview only when pointer is inside the canvas
  if (!isHovering) return;

  if (currentTool === "draw") {
    const w = Math.max(1, getStrokeWidth());
    const wSafe = Math.max(MIN_STROKE_WIDTH, w);

    context.save();
    context.beginPath();
    context.fillStyle = `rgba(0,0,0,${HOVER_FILL_ALPHA})`; // faint fill
    context.strokeStyle = `rgba(0,0,0,${HOVER_STROKE_ALPHA})`; // faint outline
    context.lineWidth = PREVIEW_STROKE_WIDTH;
    context.arc(hoverX, hoverY, wSafe / 2, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.closePath();
    context.restore();
  } else {
    // if a sticker tool is selected, show its label as a preview
    const sticker = STICKERS.find((x) => x.id === currentTool);
    if (sticker) {
      context.font = `${
        Math.max(MIN_STICKER_PREVIEW_FONT, sticker.size / 2)
      }px sans-serif`;
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
    const stroke = makeStrokeDrawable(getStrokeWidth(), currentStrokeColor);
    stroke.points.push({ x: e.offsetX, y: e.offsetY, t: Date.now() });
    pushPending(stroke);
    currentDrawable = stroke;
    return;
  }

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
    // notify observer to clear & redraw committed + pending drawables
    emitDrawingChanged();
    updateStrokesListUI();
  }
});

canvas.addEventListener(EVENT_DRAWING_CHANGED, (_ev) => {
  // When drawing changes we clear and redraw the committed items.
  // This keeps live drawing responsive while centralizing the redraw logic.
  redrawCommittedAndPending();
});

canvas.addEventListener(EVENT_HOVERING_IN_CANVAS, (ev) => {
  // Hover event is typed; use its detail payload
  const detail = (ev as CustomEvent<HoveringInCanvasDetail>).detail;
  if (detail.x !== undefined && detail.y !== undefined) {
    hoverX = detail.x;
    hoverY = detail.y;
  }
  isHovering = !!detail.inside;
  // For example, show a preview of the brush at the given coordinates
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

if (exportBtn) {
  exportBtn.addEventListener("click", () => exportDisplayAsPNG());
}

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

  // ensure UI shows initial color (black)
  if (sliderR) sliderR.value = String(0);
  if (sliderG) sliderG.value = String(0);
  if (sliderB) sliderB.value = String(0);
  if (colorSwatch) colorSwatch.style.background = currentStrokeColor;

  if (sliderR) sliderR.addEventListener("input", updateColorFromSliders);
  if (sliderG) sliderG.addEventListener("input", updateColorFromSliders);
  if (sliderB) sliderB.addEventListener("input", updateColorFromSliders);
  // wire the Add Sticker button to prompt the user and append a new sticker
  const addStickerBtnEl = document.getElementById(
    "addStickerBtn",
  ) as HTMLButtonElement | null;
  if (addStickerBtnEl) {
    addStickerBtnEl.addEventListener("click", () => {
      const label = prompt("Enter sticker text (emoji or text):", "⭐");
      if (!label) return;
      const sizeInput = prompt(
        `Enter size in px (${STICKER_MIN_SIZE}-${STICKER_MAX_SIZE}):`,
        String(DEFAULT_STICKER_SIZE),
      );
      const size = Math.min(
        STICKER_MAX_SIZE,
        Math.max(STICKER_MIN_SIZE, Number(sizeInput) || DEFAULT_STICKER_SIZE),
      );
      const id = "sticker_" + Math.random().toString(36).slice(2, 9);
      const def = { id, label, size };
      STICKERS.push(def);
      // create button for new sticker
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = id;
      btn.textContent = label;
      btn.title = label;
      btn.addEventListener("click", () => {
        currentTool = id;
        toolDrawBtn.disabled = false;
        emitDrawingChanged();
        updateStrokesListUI();
      });
      stickerContainer.appendChild(btn);
    });
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
