declare module '*.css';

interface ImportMetaEnv {
  readonly FALLSTACK_BUILD_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
