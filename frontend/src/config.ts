declare global {
  interface Window {
    __LEXA_CONFIG__?: {
      apiUrl: string;
    };
  }
}

const API_URL: string = window.__LEXA_CONFIG__?.apiUrl || window.location.origin;

export default API_URL;