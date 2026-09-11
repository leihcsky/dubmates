declare module "ogv" {
  export const OGVLoader: {
    base: string;
  };

  export class OGVPlayer extends HTMLElement {
    constructor(options?: { wasm?: boolean; webGL?: boolean });
    src: string;
    muted: boolean;
    currentTime: number;
    duration: number;
    ended: boolean;
    paused: boolean;
    videoWidth: number;
    videoHeight: number;
    play(): Promise<void>;
    pause(): void;
    load(): void;
  }
}
