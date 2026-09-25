// Backend base URL. Set REACT_APP_API_BASE_URL when deploying so the app
// doesn't point at localhost in production; falls back to the local dev
// backend when unset.
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8090";
