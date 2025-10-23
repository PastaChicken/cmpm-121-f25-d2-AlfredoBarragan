import exampleIconUrl from "./noun-paperclip-7598668-00449F.png";
import "./style.css";
//recommed to create drawable.ts file and define Drawable interface there
//for cleaner code :)
import { DrawableClass } from "./drawable.ts";

document.body.innerHTML = `
 <h1> Insert Title Here 1 </h1>
  <p>Example image asset: <img src="${exampleIconUrl}" class="icon" /></p>
  <div style="display:flex;gap:12px;align-items:flex-start">
    <canvas id="canvaspad" class="canvas" width="256" height="256"></canvas>
    <div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <button id="thinner" type="button">-</button>
        <span id="thicknessDisplay">1</span>
        <button id="thicker" type="button">+</button>
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
const cursor = { active: false, x: 0, y: 0 };

const DrawableObj = new DrawableClass();
//initalize all variables used for UI
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

//for tool preview
const HOVER_EMIT_INTERVAL = 100; // ms
let isHovering = false;
let lastHoverEmit = 0;
let hoverX = 0;
let hoverY = 0;

function updateThicknessUI() {
  if (!thicknessDisplay) return;
  thicknessDisplay.textContent = DrawableObj.getStrokeWidth().toString();
}

// Set drawing properties

function emitDrawingChanged() {
  const event = new Event("drawingChanged");
  canvas.dispatchEvent(event);
}

function updateStrokesListUI() {
  if (!strokesList) return;
  const breakdown = DrawableObj.strokeLengths().join(", ") || "none";
  strokesList.textContent =
    `Strokes: ${DrawableObj.strokeCount()} | Redo: ${DrawableObj.redoCount()} | lengths: ${breakdown}`;
}

function emitOnHoveringInCanvas(x?: number, y?: number, inside = false) {
  const event = new CustomEvent("hoveringInCanvas", {
    detail: { x, y, inside },
  });
  canvas.dispatchEvent(event);
}

// Draw function with hover preview
function drawAndPreview() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  DrawableObj.draw(context);

  // draw hover preview only when pointer is inside the canvas
  if (!isHovering) return;

  const w = Math.max(1, DrawableObj.getStrokeWidth());
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
}

// Canvas mouse event listeners
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;
  DrawableObj.begin(cursor.x, cursor.y);
  updateStrokesListUI();
});

canvas.addEventListener("mouseup", (_e) => {
  cursor.active = false;
  DrawableObj.end();
});

canvas.addEventListener("mousemove", (e) => {
  if (cursor.active) {
    DrawableObj.drag(e.offsetX, e.offsetY);
    updateStrokesListUI();
    cursor.x = e.offsetX;
    cursor.y = e.offsetY;
  }
});

canvas.addEventListener("drawingChanged", (_ev) => {
  //context.clearRect(0, 0, canvas.width, canvas.height);
  // DrawableObj.draw(context);
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

drawChangesBtn.addEventListener("click", () => {
  emitDrawingChanged();
});

clearBtn.addEventListener("click", () => {
  DrawableObj.clear();
  emitDrawingChanged();
  updateStrokesListUI();
});

undoBtn.addEventListener("click", () => {
  DrawableObj.undo();
  emitDrawingChanged();
  updateStrokesListUI();
});

redoBtn.addEventListener("click", () => {
  DrawableObj.redo();
  emitDrawingChanged();
  updateStrokesListUI();
});

thickerBtn.addEventListener("click", () => {
  DrawableObj.setStrokeWidth(DrawableObj.getStrokeWidth() + 1);
  updateThicknessUI();
});

thinnerBtn.addEventListener("click", () => {
  DrawableObj.setStrokeWidth(Math.max(1, DrawableObj.getStrokeWidth() - 1));
  updateThicknessUI();
});
