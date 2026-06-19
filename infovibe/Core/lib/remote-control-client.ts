/**
 * Remote Control Client - Handles remote control functionality in the browser
 */

import type { RemoteControlEvent } from './remote-control';

type RemoteControlSession = {
  sessionId: string;
  targetWindowId: number;
  isActive: boolean;
  startTime: number;
};

type RemoteControlClientOptions = {
  onSessionStart?: (session: RemoteControlSession) => void;
  onSessionEnd?: (session: RemoteControlSession) => void;
  onEventReceived?: (event: RemoteControlEvent) => void;
  onError?: (error: Error) => void;
};

export class RemoteControlClient {
  private activeSession: RemoteControlSession | null = null;
  private eventSimulator: any = null;
  private mouseTracker: any = null;
  private keyboardTracker: any = null;
  public options: RemoteControlClientOptions;
  private isInitialized = false;

  constructor(options: RemoteControlClientOptions = {}) {
    this.options = options;
  }

  /**
   * Initialize the remote control client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Check if we're running in the desktop app
    if (!this.isDesktopApp()) {
      throw new Error('Remote control is only available in the desktop app');
    }

    // Load the remote control modules dynamically
    const { RemoteControlEventSimulator } = await import('./remote-control');
    const { RemoteControlMouseTracker, RemoteControlKeyboardTracker } = await import('./remote-control');

    this.eventSimulator = new RemoteControlEventSimulator();
    this.mouseTracker = new RemoteControlMouseTracker(this.handleEvent.bind(this));
    this.keyboardTracker = new RemoteControlKeyboardTracker(this.handleEvent.bind(this));

    // Set up event listeners for desktop app IPC
    this.setupDesktopAppListeners();

    this.isInitialized = true;
  }

  /**
   * Check if we're running in the desktop app
   */
  private isDesktopApp(): boolean {
    return typeof window !== 'undefined' && 
           typeof (window as any).infovibeDesktop !== 'undefined' &&
           typeof (window as any).infovibeDesktop.remoteControl !== 'undefined';
  }

  /**
   * Set up event listeners for the desktop app
   */
  private setupDesktopAppListeners(): void {
    const desktop = (window as any).infovibeDesktop.remoteControl;

    // Listen for remote control events
    desktop.onEvent((event: RemoteControlEvent) => {
      this.handleIncomingEvent(event);
    });

    // Listen for remote control session requests
    desktop.onRequest((request: any) => {
      this.handleSessionRequest(request);
    });

    // Listen for remote control session responses
    desktop.onResponse((response: any) => {
      this.handleSessionResponse(response);
    });

    // Listen for remote control session termination
    desktop.onTerminated((termination: any) => {
      this.handleSessionTermination(termination);
    });
  }

  /**
   * Handle incoming remote control events
   */
  private handleIncomingEvent(event: RemoteControlEvent): void {
    if (!this.activeSession || !this.activeSession.isActive) return;

    try {
      this.eventSimulator.simulateEvent(event);
      this.options.onEventReceived?.(event);
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Handle remote control session requests
   */
  private handleSessionRequest(request: any): void {
    // In a real implementation, you'd show a UI dialog to ask the user
    // For now, we'll automatically accept the request
    this.acceptSession(request.sessionId);
  }

  /**
   * Handle remote control session responses
   */
  private handleSessionResponse(response: any): void {
    if (response.accepted) {
      this.activeSession = {
        sessionId: response.sessionId,
        targetWindowId: response.targetWindowId,
        isActive: true,
        startTime: Date.now()
      };
      this.options.onSessionStart?.(this.activeSession);
    } else {
      this.options.onError?.(new Error('Remote control session was declined'));
    }
  }

  /**
   * Handle remote control session termination
   */
  private handleSessionTermination(termination: any): void {
    if (this.activeSession && this.activeSession.sessionId === termination.sessionId) {
      this.options.onSessionEnd?.(this.activeSession);
      this.activeSession = null;
    }
  }

  /**
   * Accept a remote control session
   */
  private async acceptSession(sessionId: string): Promise<void> {
    const desktop = (window as any).infovibeDesktop.remoteControl;
    await desktop.respondSession(sessionId, true);
  }

  /**
   * Decline a remote control session
   */
  private async declineSession(sessionId: string): Promise<void> {
    const desktop = (window as any).infovibeDesktop.remoteControl;
    await desktop.respondSession(sessionId, false);
  }

  /**
   * Request remote control of another user
   */
  async requestRemoteControl(targetUserId: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Remote control client not initialized');
    }

    const desktop = (window as any).infovibeDesktop.remoteControl;
    const response = await desktop.requestSession(targetUserId);

    if (!response.success) {
      throw new Error(response.error || 'Failed to request remote control');
    }

    return response.sessionId;
  }

  /**
   * Start controlling a target window
   */
  async startControlling(targetWindowId: number): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Remote control client not initialized');
    }

    // Start tracking mouse and keyboard events
    this.startEventTracking();

    // Store the target window ID
    if (this.activeSession) {
      this.activeSession.targetWindowId = targetWindowId;
    }
  }

  /**
   * Stop controlling a target window
   */
  async stopControlling(): Promise<void> {
    if (!this.activeSession) return;

    // Stop tracking events
    this.stopEventTracking();

    // Terminate the session
    const desktop = (window as any).infovibeDesktop.remoteControl;
    await desktop.terminateSession(this.activeSession.sessionId);
  }

  /**
   * Start tracking mouse and keyboard events
   */
  private startEventTracking(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('mousemove', this.mouseTracker.handleMouseMove.bind(this.mouseTracker));
    document.addEventListener('mousedown', this.mouseTracker.handleMouseClick.bind(this.mouseTracker));
    document.addEventListener('keydown', this.keyboardTracker.handleKeyDown.bind(this.keyboardTracker));
    document.addEventListener('wheel', this.mouseTracker.handleScroll.bind(this.mouseTracker));
  }

  /**
   * Stop tracking mouse and keyboard events
   */
  private stopEventTracking(): void {
    if (typeof document === 'undefined') return;

    document.removeEventListener('mousemove', this.mouseTracker.handleMouseMove.bind(this.mouseTracker));
    document.removeEventListener('mousedown', this.mouseTracker.handleMouseClick.bind(this.mouseTracker));
    document.removeEventListener('keydown', this.keyboardTracker.handleKeyDown.bind(this.keyboardTracker));
    document.removeEventListener('wheel', this.mouseTracker.handleScroll.bind(this.mouseTracker));
  }

  /**
   * Handle local events and send them to the remote target
   */
  private async handleEvent(event: RemoteControlEvent): Promise<void> {
    if (!this.activeSession || !this.activeSession.isActive) return;

    const desktop = (window as any).infovibeDesktop.remoteControl;
    await desktop.sendEvent(this.activeSession.targetWindowId, event);
  }

  /**
   * Get the current active session
   */
  getActiveSession(): RemoteControlSession | null {
    return this.activeSession;
  }

  /**
   * Check if remote control is active
   */
  isRemoteControlActive(): boolean {
    return this.activeSession?.isActive ?? false;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopEventTracking();
    
    if (this.isDesktopApp()) {
      const desktop = (window as any).infovibeDesktop.remoteControl;
      desktop.removeAllListeners();
    }

    this.activeSession = null;
    this.isInitialized = false;
  }
}

// Export a singleton instance for easy use
export const remoteControlClient = new RemoteControlClient();
