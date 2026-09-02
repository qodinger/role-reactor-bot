/**
 * Minimal type stub for the `ws` package (ships no bundled types and
 * @types/ws is not installed). Mapped via jsconfig "paths" so tsc resolves
 * `import WebSocket from "ws"` here instead of type-checking ws's JS impl.
 * Covers the API surface used by the streaming features.
 */
import { EventEmitter } from "events";

export interface WebSocketServerOptions {
  port?: number;
  server?: any;
  path?: string;
  verifyClient?: (...args: any[]) => boolean;
  [key: string]: any;
}

export declare class WebSocketServer extends EventEmitter {
  constructor(options?: WebSocketServerOptions);
  clients: Set<WebSocket>;
  close(cb?: () => void): void;
  on(event: "connection", cb: (socket: WebSocket, req: any) => void): this;
  on(event: string, cb: (...args: any[]) => void): this;
}

export default class WebSocket extends EventEmitter {
  static readonly CONNECTING: number;
  static readonly OPEN: number;
  static readonly CLOSING: number;
  static readonly CLOSED: number;

  constructor(address: string, protocols?: string | string[] | object);

  readyState: number;
  protocol: string;
  url: string;

  onopen: ((this: WebSocket) => void) | null;
  onmessage: ((this: WebSocket, data: any, isBinary?: boolean) => void) | null;
  onclose: ((this: WebSocket, code?: number, reason?: any) => void) | null;
  onerror: ((this: WebSocket, err: Error) => void) | null;

  on(event: "open", cb: () => void): this;
  on(event: "message", cb: (data: Buffer, isBinary: boolean) => void): this;
  on(event: "close", cb: (code: number, reason: Buffer) => void): this;
  on(event: "error", cb: (err: Error) => void): this;
  on(event: string, cb: (...args: any[]) => void): this;

  send(data: string | Buffer | ArrayBuffer | Uint8Array, cb?: (err?: Error) => void): void;
  ping(data?: any, mask?: boolean, cb?: () => void): void;
  pong(data?: any, mask?: boolean, cb?: () => void): void;
  close(code?: number, data?: string): void;
  terminate(): void;
}
