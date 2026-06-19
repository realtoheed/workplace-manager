/**
 * Remote Control Events - Ported from Core/lib/remote-control.ts
 * Used in the meet iframe for cross-browser mouse/keyboard control via LiveKit data channel.
 */

class RemoteControlMouseTracker {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.lastX = 0;
    this.lastY = 0;
    this.lastClickTime = 0;
    this.clickCount = 0;
    this.clickCountTimeout = null;
    this._boundMove = null;
    this._boundClick = null;
    this._boundScroll = null;
    this._boundContext = null;
  }

  start() {
    if (this._boundMove) return;
    this._boundMove = this.handleMouseMove.bind(this);
    this._boundClick = this.handleMouseClick.bind(this);
    this._boundScroll = this.handleScroll.bind(this);
    this._boundContext = (e) => e.preventDefault();
    window.addEventListener("mousemove", this._boundMove);
    window.addEventListener("mousedown", this._boundClick);
    window.addEventListener("wheel", this._boundScroll, { passive: true });
    window.addEventListener("contextmenu", this._boundContext);
  }

  stop() {
    if (this._boundMove) {
      window.removeEventListener("mousemove", this._boundMove);
      window.removeEventListener("mousedown", this._boundClick);
      window.removeEventListener("wheel", this._boundScroll);
      window.removeEventListener("contextmenu", this._boundContext);
      this._boundMove = null;
      this._boundClick = null;
      this._boundScroll = null;
      this._boundContext = null;
    }
  }

  handleMouseMove(e) {
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.onEvent({
      type: "mouse:move",
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now(),
    });
  }

  handleMouseClick(e) {
    const now = Date.now();
    const isDoubleClick = now - this.lastClickTime < 300;
    if (isDoubleClick) {
      this.clickCount++;
    } else {
      this.clickCount = 1;
    }
    this.lastClickTime = now;
    if (this.clickCountTimeout) clearTimeout(this.clickCountTimeout);
    this.clickCountTimeout = setTimeout(() => { this.clickCount = 0; }, 300);

    const buttonMap = { 0: "left", 1: "middle", 2: "right" };
    this.onEvent({
      type: "mouse:click",
      x: e.clientX,
      y: e.clientY,
      button: buttonMap[e.button] || "left",
      clickCount: this.clickCount,
      timestamp: now,
    });
  }

  handleScroll(e) {
    this.onEvent({
      type: "scroll",
      x: e.clientX,
      y: e.clientY,
      deltaY: e.deltaY,
      deltaX: e.deltaX,
      timestamp: Date.now(),
    });
  }

  destroy() {
    this.stop();
    if (this.clickCountTimeout) clearTimeout(this.clickCountTimeout);
  }
}

class RemoteControlKeyboardTracker {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this._boundKey = null;
  }

  start() {
    if (this._boundKey) return;
    this._boundKey = this.handleKeyDown.bind(this);
    window.addEventListener("keydown", this._boundKey);
  }

  stop() {
    if (this._boundKey) {
      window.removeEventListener("keydown", this._boundKey);
      this._boundKey = null;
    }
  }

  handleKeyDown(e) {
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
    this.onEvent({
      type: "key:press",
      code: e.code,
      key: e.key,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      timestamp: Date.now(),
    });
  }

  destroy() {
    this.stop();
  }
}

class RemoteControlEventSimulator {
  constructor() {
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.cursorElement = null;
    this.createRemoteCursor();
  }

  createRemoteCursor() {
    this.cursorElement = document.createElement("div");
    this.cursorElement.id = "remote-control-cursor";
    this.cursorElement.style.cssText = [
      "position: fixed;",
      "width: 20px;",
      "height: 20px;",
      "border: 2px solid #4f46e5;",
      "border-radius: 50%;",
      "pointer-events: none;",
      "z-index: 10000;",
      "display: none;",
      "background: rgba(79, 70, 229, 0.1);",
      "box-shadow: 0 0 6px rgba(79, 70, 229, 0.5);",
      "transition: transform 0.05s linear;",
    ].join(" ");
    document.body.appendChild(this.cursorElement);
  }

  showRemoteCursor() {
    if (this.cursorElement) this.cursorElement.style.display = "block";
  }

  hideRemoteCursor() {
    if (this.cursorElement) this.cursorElement.style.display = "none";
  }

  simulateMouseMove(x, y) {
    this.lastMouseX = x;
    this.lastMouseY = y;
    if (this.cursorElement) {
      this.cursorElement.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
    }
  }

  simulateMouseClick(x, y, button) {
    const element = document.elementFromPoint(x, y);
    if (!element) return;
    const buttonCode = button === "left" ? 0 : button === "middle" ? 1 : 2;
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: buttonCode }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: buttonCode }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: buttonCode }));
  }

  simulateKeyPress(code, key, ctrlKey, shiftKey, altKey) {
    const element = document.activeElement || document.body;
    const opts = { bubbles: true, cancelable: true, code, key, ctrlKey, shiftKey, altKey };
    element.dispatchEvent(new KeyboardEvent("keydown", opts));
    element.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  simulateScroll(x, y, deltaY, deltaX) {
    const element = document.elementFromPoint(x, y);
    if (!element) return;
    element.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY, deltaX, deltaZ: 0 }));
  }

  simulateEvent(event) {
    switch (event.type) {
      case "mouse:move": this.simulateMouseMove(event.x, event.y); break;
      case "mouse:click": this.simulateMouseClick(event.x, event.y, event.button); break;
      case "key:press": this.simulateKeyPress(event.code, event.key, event.ctrlKey, event.shiftKey, event.altKey); break;
      case "scroll": this.simulateScroll(event.x, event.y, event.deltaY, event.deltaX); break;
    }
  }

  destroy() {
    if (this.cursorElement) this.cursorElement.remove();
    this.cursorElement = null;
  }
}

export { RemoteControlMouseTracker, RemoteControlKeyboardTracker, RemoteControlEventSimulator };
