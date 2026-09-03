const API_URL: string = window.__LEXA_CONFIG__?.apiUrl || window.location.origin;

declare global {
  interface Window {
    __LEXA_CONFIG__?: { apiUrl: string };
  }
}

export default API_URL;