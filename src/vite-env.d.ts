/// <reference types="vite/client" />

declare const __BUILD_TIME__: string;

declare module "monaco-editor/editor/editor.api.js" {
  export * from "monaco-editor";
}
