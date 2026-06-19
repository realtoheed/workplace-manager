/**
 * Remote Control Events - Used for sending commands over WebRTC/WebSocket
 */

export type RemoteControlEvent =
  | MouseMoveEvent
  | MouseClickEvent
  | KeyPressEvent
  | ScrollEvent
  | ScreenCaptureEvent;

export type MouseMoveEvent = {
  type: "mouse:move";
  x: number;
  y: number;
  timestamp: number;
};

export type MouseClickEvent = {
  type: "mouse:click";
  x: number;
  y: number;
  button: "left" | "middle" | "right";
  clickCount: number;
  timestamp: number;
};

export type KeyPressEvent = {
  type: "key:press";
  code: string;
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  timestamp: number;
};

export type ScrollEvent = {
  type: "scroll";
  x: number;
  y: number;
  deltaY: number;
  deltaX: number;
  timestamp: number;
};

export type ScreenCaptureEvent = {
  type: "screen:capture";
  canvas: ImageData;
  timestamp: number;
};

/**
 * Mouse tracking for remote control
 */
export class RemoteControlMouseTracker {
  private lastX = 0;
  private lastY = 0;
  private lastClickTime = 0;
  private clickCount = 0;
  private clickCountTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private onEvent: (event: RemoteControlEvent) => void) {}

  handleMouseMove(e: MouseEvent, debounceMs = 16) {
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    const moveEvent: MouseMoveEvent = {
      type: "mouse:move",
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now()
    };

    this.onEvent(moveEvent);
  }

  handleMouseClick(e: MouseEvent) {
    const now = Date.now();
    const isDoubleClick = now - this.lastClickTime < 300;

    if (isDoubleClick) {
      this.clickCount++;
    } else {
      this.clickCount = 1;
    }

    this.lastClickTime = now;

    // Reset click count after timeout
    if (this.clickCountTimeout) {
      clearTimeout(this.clickCountTimeout);
    }
    this.clickCountTimeout = setTimeout(() => {
      this.clickCount = 0;
    }, 300);

    const buttonMap = { 0: "left", 1: "middle", 2: "right" } as const;

    const clickEvent: MouseClickEvent = {
      type: "mouse:click",
      x: e.clientX,
      y: e.clientY,
      button: buttonMap[e.button as 0 | 1 | 2] || "left",
      clickCount: this.clickCount,
      timestamp: now
    };

    this.onEvent(clickEvent);
  }

  handleScroll(e: WheelEvent) {
    const scrollEvent: ScrollEvent = {
      type: "scroll",
      x: e.clientX,
      y: e.clientY,
      deltaY: e.deltaY,
      deltaX: e.deltaX,
      timestamp: Date.now()
    };

    this.onEvent(scrollEvent);
  }

  destroy() {
    if (this.clickCountTimeout) {
      clearTimeout(this.clickCountTimeout);
    }
  }
}

/**
 * Keyboard tracking for remote control
 */
export class RemoteControlKeyboardTracker {
  constructor(private onEvent: (event: RemoteControlEvent) => void) {}

  handleKeyDown(e: KeyboardEvent) {
    // Skip modifier keys alone
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
      return;
    }

    const keyEvent: KeyPressEvent = {
      type: "key:press",
      code: e.code,
      key: e.key,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      timestamp: Date.now()
    };

    this.onEvent(keyEvent);
  }

  destroy() {
    // Cleanup if needed
  }
}

/**
 * Remote control event simulator - applies incoming events to the screen
 */
export class RemoteControlEventSimulator {
  private lastMouseX = 0;
  private lastMouseY = 0;
  private cursorElement: HTMLElement | null = null;

  constructor(private containerId?: string) {
    this.createRemoteCursor();
  }

  private createRemoteCursor() {
    this.cursorElement = document.createElement("div");
    this.cursorElement.id = "remote-control-cursor";
    this.cursorElement.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      border: 2px solid #4f46e5;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
      display: none;
      background: rgba(79, 70, 229, 0.1);
      box-shadow: 0 0 6px rgba(79, 70, 229, 0.5);
      transition: all 0.05s ease-out;
    `;
    document.body.appendChild(this.cursorElement);
  }

  showRemoteCursor() {
    if (this.cursorElement) {
      this.cursorElement.style.display = "block";
    }
  }

  hideRemoteCursor() {
    if (this.cursorElement) {
      this.cursorElement.style.display = "none";
    }
  }

  simulateMouseMove(x: number, y: number) {
    this.lastMouseX = x;
    this.lastMouseY = y;

    if (this.cursorElement) {
      this.cursorElement.style.left = `${x - 10}px`;
      this.cursorElement.style.top = `${y - 10}px`;
    }
  }

  simulateMouseClick(x: number, y: number, button: "left" | "middle" | "right") {
    const element = document.elementFromPoint(x, y);

    if (!element) return;

    const buttonCode = button === "left" ? 0 : button === "middle" ? 1 : 2;

    // Simulate mouse down
    element.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: buttonCode
      })
    );

    // Simulate mouse up
    element.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: buttonCode
      })
    );

    // Simulate click
    element.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: buttonCode
      })
    );
  }

  simulateKeyPress(code: string, key: string, ctrlKey = false, shiftKey = false, altKey = false) {
    const element = document.activeElement || document.body;

    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code,
        key,
        ctrlKey,
        shiftKey,
        altKey
      })
    );

    element.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        code,
        key,
        ctrlKey,
        shiftKey,
        altKey
      })
    );
  }

  simulateScroll(x: number, y: number, deltaY: number, deltaX = 0) {
    const element = document.elementFromPoint(x, y);

    if (!element) return;

    element.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        deltaY,
        deltaX,
        deltaZ: 0
      })
    );
  }

  simulateEvent(event: RemoteControlEvent) {
    switch (event.type) {
      case "mouse:move":
        this.simulateMouseMove(event.x, event.y);
        break;

      case "mouse:click":
        this.simulateMouseClick(event.x, event.y, event.button);
        break;

      case "key:press":
        this.simulateKeyPress(event.code, event.key, event.ctrlKey, event.shiftKey, event.altKey);
        break;

      case "scroll":
        this.simulateScroll(event.x, event.y, event.deltaY, event.deltaX);
        break;
    }
  }

  destroy() {
    if (this.cursorElement) {
      this.cursorElement.remove();
    }
  }
}
