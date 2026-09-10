declare module 'opencascade.js' {
  export interface OpenCascadeInitOptions {
    locateFile?: (path: string, prefix?: string) => string;
    [key: string]: unknown;
  }

  export default function initOpenCascade(options?: OpenCascadeInitOptions): Promise<any>;
}
