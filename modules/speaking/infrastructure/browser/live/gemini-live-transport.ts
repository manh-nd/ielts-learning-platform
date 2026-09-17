/**
 * WebSocket transport interface for Gemini Live browser connection.
 * Technical wrapper ONLY — owns WebSocket lifecycle, raw string send, raw string receive, close.
 * MUST NOT know Application events, IELTS domain concepts, or protocol mapping logic.
 */
export interface GeminiLiveTransport {
  connect(wsUrl: string, setupPayload?: unknown): Promise<void>;
  send(payload: unknown): void;
  onRawMessage(listener: (rawMessage: string) => void): () => void;
  onClose(
    listener: (event: {
      code: number;
      reason: string;
      wasClean: boolean;
    }) => void
  ): () => void;
  onError(listener: (error: Error | Event) => void): () => void;
  close(): void;
  readonly isOpen: boolean;
}

export type WebSocketFactory = (url: string) => WebSocket;

/**
 * Default browser implementation of GeminiLiveTransport using WebSocket.
 */
export class DefaultGeminiLiveTransport implements GeminiLiveTransport {
  private ws: WebSocket | null = null;
  private rawMessageListeners: Set<(rawMessage: string) => void> = new Set();
  private closeListeners: Set<
    (event: { code: number; reason: string; wasClean: boolean }) => void
  > = new Set();
  private errorListeners: Set<(error: Error | Event) => void> = new Set();
  private createWebSocket: WebSocketFactory;

  constructor(customWebSocketFactory?: WebSocketFactory) {
    this.createWebSocket =
      customWebSocketFactory ||
      ((url: string) => {
        if (typeof WebSocket === "undefined") {
          throw new Error(
            "WebSocket API is not available in this environment."
          );
        }
        return new WebSocket(url);
      });
  }

  get isOpen(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  async connect(wsUrl: string, setupPayload?: unknown): Promise<void> {
    this.close();

    return new Promise((resolve, reject) => {
      let isSettled = false;

      try {
        const ws = this.createWebSocket(wsUrl);
        this.ws = ws;

        ws.onopen = () => {
          if (setupPayload !== undefined) {
            try {
              const text =
                typeof setupPayload === "string"
                  ? setupPayload
                  : JSON.stringify(setupPayload);
              ws.send(text);
            } catch (err) {
              if (!isSettled) {
                isSettled = true;
                reject(err);
              }
              return;
            }
          }
          if (!isSettled) {
            isSettled = true;
            resolve();
          }
        };

        ws.onmessage = async (event: MessageEvent) => {
          let textData = "";
          if (typeof Blob !== "undefined" && event.data instanceof Blob) {
            textData = await event.data.text();
          } else if (typeof event.data === "string") {
            textData = event.data;
          } else {
            return;
          }

          for (const listener of this.rawMessageListeners) {
            try {
              listener(textData);
            } catch (err) {
              console.error(
                "[GeminiLiveTransport] Error in rawMessage listener:",
                err
              );
            }
          }
        };

        ws.onerror = (err: Event) => {
          if (!isSettled) {
            isSettled = true;
            reject(new Error("WebSocket connection error"));
          }
          for (const listener of this.errorListeners) {
            try {
              listener(err);
            } catch (e) {
              console.error(
                "[GeminiLiveTransport] Error in error listener:",
                e
              );
            }
          }
        };

        ws.onclose = (evt: CloseEvent) => {
          if (!isSettled) {
            isSettled = true;
            reject(
              new Error(
                `WebSocket closed before setup completed: ${evt.reason || "code " + evt.code}`
              )
            );
          }
          const closeDetails = {
            code: evt.code,
            reason: evt.reason || "",
            wasClean: evt.wasClean,
          };
          for (const listener of this.closeListeners) {
            try {
              listener(closeDetails);
            } catch (e) {
              console.error(
                "[GeminiLiveTransport] Error in close listener:",
                e
              );
            }
          }
        };
      } catch (err) {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      }
    });
  }

  send(payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[GeminiLiveTransport] Cannot send: WebSocket is not OPEN.");
      return;
    }

    try {
      const text =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      this.ws.send(text);
    } catch (err) {
      console.error(
        "[GeminiLiveTransport] Error sending payload over WebSocket:",
        err
      );
    }
  }

  onRawMessage(listener: (rawMessage: string) => void): () => void {
    this.rawMessageListeners.add(listener);
    return () => {
      this.rawMessageListeners.delete(listener);
    };
  }

  onClose(
    listener: (event: {
      code: number;
      reason: string;
      wasClean: boolean;
    }) => void
  ): () => void {
    this.closeListeners.add(listener);
    return () => {
      this.closeListeners.delete(listener);
    };
  }

  onError(listener: (error: Error | Event) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  close(): void {
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
      } catch {
        // Ignored
      }
    }
  }
}
