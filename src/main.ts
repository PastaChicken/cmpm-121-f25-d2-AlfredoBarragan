import exampleIconUrl from "./noun-paperclip-7598668-00449F.png";
import "./style.css";
//recommed to create drawable.ts file and define Drawable interface there
//for cleaner code :)
import { DrawableClass } from "./drawable.ts";
/*
class Drawable implements Drawable {
  constructor(private imageUrl: string) { }

  display(ctx: CanvasRenderingContext2D): void {

  }
}
*/
document.body.innerHTML = `
 <h1> Insert Title Here 1 </h1>
  <p>Example image asset: <img src="${exampleIconUrl}" class="icon" /></p>
  <canvas id="canvaspad" class="canvas" width="256" height="256"></canvas>
  <button id="drawChanges" type="button">DrawChanges</button>
  <button id="undoBtn" type="button">Undo</button>
  <button id="redoBtn" type="button">Redo</button> 
`;

const canvas = document.getElementById("canvaspad") as HTMLCanvasElement;
//code before step 5
/*
type Point = { x: number; y: number; t: number };
const strokes: Point[][] = [];
//needed for step 4
const redoStacks: Point[][] = [];
let currentStroke: Point[] | null = null;
*/

const context = canvas.getContext("2d")!;
const cursor = { active: false, x: 0, y: 0 };

const DrawableObj = new DrawableClass();
const strokesList = document.getElementById("strokesList") as HTMLUListElement;

// Set drawing properties
context.strokeStyle = "black";
context.lineWidth = 1;

function emitDrawingChanged() {
  const event = new Event("drawingChanged");
  canvas.dispatchEvent(event);
}

function updateStrokesListUI() {
  /*

  const breakdown = strokes.map((s) => s.length).join(", ") || "none";
  strokesList.textContent =
    `Strokes: ${strokes.length} | Redo: ${redoStacks.length} | lengths: ${breakdown}`; */
  if (!strokesList) return;
  const breakdown = DrawableObj.strokeLengths().join(", ") || "none";
  strokesList.textContent =
    `Strokes: ${DrawableObj.strokeCount()} | Redo: ${DrawableObj.redoCount()} | lengths: ${breakdown}`;
}

// Canvas mouse event listeners
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;

  /*
  currentStroke = [];
  const p: Point = { x: cursor.x, y: cursor.y, t: Date.now() };
  currentStroke.push(p);
  strokes.push(currentStroke);

  //notify drawing changed
  // emitDrawingChanged();
  updateStrokesListUI(); */
  DrawableObj.begin(cursor.x, cursor.y);
  // emitDrawingChanged();
  updateStrokesListUI();
});

canvas.addEventListener("mouseup", (_e) => {
  cursor.active = false;

  // currentStroke = null;
  DrawableObj.end();
});

canvas.addEventListener("mousemove", (e) => {
  if (cursor.active) {
    //draw line
    //  drawLine(context, cursor.x, cursor.y, e.offsetX, e.offsetY);
    //save point
    /* const p: Point = { x: e.offsetX, y: e.offsetY, t: Date.now() };
    currentStroke.push(p);

    //emitDrawingChanged();
    updateStrokesListUI(); */

    //update cursor
    DrawableObj.drag(e.offsetX, e.offsetY);
    // emitDrawingChanged();
    updateStrokesListUI();
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

canvas.addEventListener("drawingChanged", (_ev) => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  DrawableObj.draw(context);
});

// Button event listeners
const undoBtn = document.getElementById("undoBtn") as HTMLButtonElement;
const redoBtn = document.getElementById("redoBtn") as HTMLButtonElement;
const drawChangesBtn = document.getElementById(
  "drawChanges",
) as HTMLButtonElement;

drawChangesBtn.addEventListener("click", () => {
  emitDrawingChanged();
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
