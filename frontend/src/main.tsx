import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

let rootElement = document.getElementById('lexa-widget-root');
if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'lexa-widget-root';
    document.body.appendChild(rootElement);
}

createRoot(rootElement).render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
)