declare global {
  interface Window {
    __SNAPLAB_READY__?: boolean;
  }
  interface ImportMetaEnv {
    /** Public origin of the API (Cloud Run). Unset = same origin. */
    readonly VITE_API_ORIGIN?: string;
  }
}

export {};
