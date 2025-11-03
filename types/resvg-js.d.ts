declare module '@resvg/resvg-js/node' {
  interface RenderOptions {
    fitTo?: unknown;
    background?: string;
  }

  interface RenderedImage {
    asPng(): Buffer;
  }

  export class Resvg {
    constructor(svg: string, opts?: RenderOptions);
    render(): RenderedImage;
  }
}
