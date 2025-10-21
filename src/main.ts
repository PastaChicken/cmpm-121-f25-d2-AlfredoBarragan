import exampleIconUrl from "./noun-paperclip-7598668-00449F.png";
import "./style.css";

document.body.innerHTML = `
 <h1> Insert Title Here 1 </h1>
  <p>Example image asset: <img src="${exampleIconUrl}" class="icon" /></p>
  <canvas id="canvaspad" class="canvas" width="256" height="256"></canvas>
  <button id="drawChanges">DrawChanges</button>
`;

const canvas = document.getElementById("canvaspad") as HTMLCanvasElement;
const context = canvas.getContext("2d")!;
const cursor = { active: false, x: 0, y: 0 };

type Point = { x: number; y: number; t: number };
const strokes: Point[][] = [];
let currentStroke: Point[] | null = null;

// Set drawing properties
context.strokeStyle = "black";
context.lineWidth = 1;

function emitDrawingChanged() {
  const event = new Event("drawingChanged");
  canvas.dispatchEvent(event);
}

// Canvas mouse event listeners
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;

  currentStroke = [];
  const p: Point = { x: cursor.x, y: cursor.y, t: Date.now() };
  currentStroke.push(p);
  strokes.push(currentStroke);

  //notify drawing changed
  // emitDrawingChanged();
});

canvas.addEventListener("mouseup", (_e) => {
  cursor.active = false;

  currentStroke = null;
});

canvas.addEventListener("mousemove", (e) => {
  if (cursor.active && currentStroke) {
    //draw line
    //  drawLine(context, cursor.x, cursor.y, e.offsetX, e.offsetY);
    //save point
    const p: Point = { x: e.offsetX, y: e.offsetY, t: Date.now() };
    currentStroke.push(p);

    //emitDrawingChanged();

    //update cursor
    cursor.x = e.offsetX;
    cursor.y = e.offsetY;
  }
});

/*
function drawLine(context: { beginPath: () => void; moveTo: (arg0: any, arg1: any) => void; lineTo: (arg0: any, arg1: any) => void; stroke: () => void; closePath: () => void; }, x1: any, y1: any, x2: any, y2: any) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.closePath();
} */

const clearButton = document.getElementById("drawChanges") as HTMLButtonElement;
clearButton.addEventListener("click", () => {
  emitDrawingChanged();

  strokes.length = 0;
  currentStroke = null;
});

canvas.addEventListener("drawingChanged", (_ev) => {
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const stroke of strokes) {
    if (!stroke || stroke.length === 0) continue;
    context.beginPath();
    context.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      context.lineTo(stroke[i].x, stroke[i].y);
    }
    context.stroke();
    context.closePath();
  }
});
