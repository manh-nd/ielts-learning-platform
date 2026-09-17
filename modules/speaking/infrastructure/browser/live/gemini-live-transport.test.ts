import { describe, it, expect } from "bun:test";
import { DefaultGeminiLiveTransport } from "./gemini-live-transport";

class MockWebSocket {
  public readyState: number = 0; // CONNECTING
  public url: string;
  public sentData: string[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((evt: { data: string }) => void) | null = null;
  public onerror: ((evt: Event) => void) | null = null;
  public onclose:
    | ((evt: { code: number; reason: string; wasClean: boolean }) => void)
    | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string) {
    this.sentData.push(data);
  }

  close(code = 1000, reason = "") {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code, reason, wasClean: true });
  }

  // Helper for test execution
  triggerOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  triggerMessage(data: string) {
    this.onmessage?.({ data });
  }

  triggerError(err: Event) {
    this.onerror?.(err);
  }
}

describe("gemini-live-transport", () => {
  it("opens WebSocket and sends setup payload upon connection", async () => {
    let mockSocket: MockWebSocket | null = null;
    const transport = new DefaultGeminiLiveTransport((url) => {
      mockSocket = new MockWebSocket(url);
      return mockSocket as unknown as WebSocket;
    });

    const setupPayload = { setup: { model: "models/gemini-3.8-live" } };
    const connectPromise = transport.connect(
      "wss://example.com/ws",
      setupPayload
    );

    expect(mockSocket).not.toBeNull();
    mockSocket!.triggerOpen();

    await connectPromise;

    expect(transport.isOpen).toBe(true);
    expect(mockSocket!.sentData).toHaveLength(1);
    expect(JSON.parse(mockSocket!.sentData[0])).toEqual(setupPayload);
  });

  it("dispatches raw message strings to rawMessage listeners", async () => {
    let mockSocket: MockWebSocket | null = null;
    const transport = new DefaultGeminiLiveTransport((url) => {
      mockSocket = new MockWebSocket(url);
      return mockSocket as unknown as WebSocket;
    });

    const received: string[] = [];
    transport.onRawMessage((msg) => received.push(msg));

    const connectPromise = transport.connect("wss://example.com/ws");
    mockSocket!.triggerOpen();
    await connectPromise;

    mockSocket!.triggerMessage('{"serverContent":{"turnComplete":true}}');

    expect(received).toEqual(['{"serverContent":{"turnComplete":true}}']);
  });

  it("handles send payload when socket is open", async () => {
    let mockSocket: MockWebSocket | null = null;
    const transport = new DefaultGeminiLiveTransport((url) => {
      mockSocket = new MockWebSocket(url);
      return mockSocket as unknown as WebSocket;
    });

    const connectPromise = transport.connect("wss://example.com/ws");
    mockSocket!.triggerOpen();
    await connectPromise;

    transport.send({ realtimeInput: { audioStreamEnd: true } });
    expect(mockSocket!.sentData).toHaveLength(1);
    expect(JSON.parse(mockSocket!.sentData[0])).toEqual({
      realtimeInput: { audioStreamEnd: true },
    });
  });

  it("dispatches close event to onClose listeners when socket closes", async () => {
    let mockSocket: MockWebSocket | null = null;
    const transport = new DefaultGeminiLiveTransport((url) => {
      mockSocket = new MockWebSocket(url);
      return mockSocket as unknown as WebSocket;
    });

    let closedReason = "";
    transport.onClose((evt) => {
      closedReason = evt.reason;
    });

    const connectPromise = transport.connect("wss://example.com/ws");
    mockSocket!.triggerOpen();
    await connectPromise;

    mockSocket!.close(1000, "normal close");
    expect(closedReason).toBe("normal close");
    expect(transport.isOpen).toBe(false);
  });
});
