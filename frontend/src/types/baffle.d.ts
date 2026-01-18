declare module 'baffle' {
  interface BaffleOptions {
    characters?: string;
    speed?: number;
  }

  interface BaffleInstance {
    start(): BaffleInstance;
    stop(): BaffleInstance;
    reveal(duration?: number, delay?: number): BaffleInstance;
    set(options: BaffleOptions): BaffleInstance;
  }

  function baffle(element: HTMLElement | null, options?: BaffleOptions): BaffleInstance;

  export default baffle;
}
