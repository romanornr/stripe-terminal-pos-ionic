/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ID?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_API_BASEURL?: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
