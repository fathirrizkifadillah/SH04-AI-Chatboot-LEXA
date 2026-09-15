/**
 * Lexa Chat Widget Loader v1.0
 * 
 * Embed script untuk menambahkan chat widget ke website manapun.
 * 
 * Usage:
 *   <script src="https://your-domain.com/widget/widget-loader.js" 
 *           data-api-url="https://your-domain.com"
 *           data-position="bottom-right"
 *           data-color="#2563eb">
 *   </script>
 */
(function() {
  'use strict';

  // Prevent double initialization
  if (window.__LEXA_WIDGET_LOADED) return;
  window.__LEXA_WIDGET_LOADED = true;

  // Read config from script tag
  var scriptTag = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('widget-loader.js') !== -1) {
        return scripts[i];
      }
    }
    return null;
  })();

  var config = {
    apiUrl: (scriptTag && scriptTag.getAttribute('data-api-url')) || window.location.origin,
    position: (scriptTag && scriptTag.getAttribute('data-position')) || 'bottom-right',
    color: (scriptTag && scriptTag.getAttribute('data-color')) || '#2563eb',
    greeting: (scriptTag && scriptTag.getAttribute('data-greeting')) || ''
  };

  // Ensure apiUrl has no trailing slash
  config.apiUrl = config.apiUrl.replace(/\/+$/, '');

  // Position styles
  var positionStyles = {
    'bottom-right': { bottom: '24px', right: '24px' },
    'bottom-left':  { bottom: '24px', left: '24px' },
    'top-right':    { top: '24px', right: '24px' },
    'top-left':     { top: '24px', left: '24px' }
  };

  var pos = positionStyles[config.position] || positionStyles['bottom-right'];

  // Inject CSS
  var css = `
    #lexa-chat-launcher {
      position: fixed;
      ${Object.keys(pos).map(k => k + ': ' + pos[k]).join('; ')};
      z-index: 2147483647;
      border: none;
      cursor: pointer;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border-radius: 50%;
      width: 64px;
      height: 64px;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #lexa-chat-launcher:hover {
      transform: scale(1.08);
    }
    #lexa-chat-launcher img {
      width: 48px;
      height: 48px;
      object-fit: contain;
    }
    #lexa-chat-frame {
      position: fixed;
      ${Object.keys(pos).map(k => k + ': ' + pos[k]).join('; ')};
      z-index: 2147483646;
      width: 380px;
      height: 640px;
      max-width: calc(100vw - 48px);
      max-height: calc(100vh - 100px);
      border: none;
      border-radius: 24px;
      box-shadow: 0 20px 60px -15px rgba(0,0,0,0.3);
      opacity: 0;
      transform: scale(0.9) translateY(20px);
      pointer-events: none;
      transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #lexa-chat-frame.lexa-open {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }
    #lexa-chat-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.2);
      z-index: 2147483645;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    #lexa-chat-overlay.lexa-open {
      opacity: 1;
      pointer-events: auto;
    }
    @media (max-width: 480px) {
      #lexa-chat-frame {
        width: calc(100vw - 16px);
        height: calc(100vh - 80px);
        max-width: none;
        max-height: none;
        border-radius: 16px;
      }
      #lexa-chat-launcher {
        width: 56px;
        height: 56px;
      }
      #lexa-chat-launcher img {
        width: 40px;
        height: 40px;
      }
    }
  `;

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Bot head SVG as fallback
  var botSvg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#2563eb"/><circle cx="35" cy="42" r="8" fill="white"/><circle cx="65" cy="42" r="8" fill="white"/><circle cx="35" cy="42" r="4" fill="#1e40af"/><circle cx="65" cy="42" r="4" fill="#1e40af"/><path d="M 30 62 Q 50 78 70 62" stroke="white" stroke-width="4" fill="none" stroke-linecap="round"/></svg>');

  // Create launcher button
  var launcher = document.createElement('button');
  launcher.id = 'lexa-chat-launcher';
  launcher.setAttribute('aria-label', 'Open Lexa Chat');
  launcher.innerHTML = '<img src="' + botSvg + '" alt="Chat" />';

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.id = 'lexa-chat-frame';
  iframe.title = 'Lexa Chat Widget';
  iframe.allow = 'microphone';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

  // Create overlay
  var overlay = document.createElement('div');
  overlay.id = 'lexa-chat-overlay';

  // Toggle state
  var isOpen = false;

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.src = config.apiUrl + '/widget/' + (config.greeting ? '?greeting=' + encodeURIComponent(config.greeting) : '');
      overlay.classList.add('lexa-open');
      iframe.classList.add('lexa-open');
      launcher.style.transform = 'scale(0)';
      setTimeout(function() { launcher.style.display = 'none'; }, 300);
    } else {
      overlay.classList.remove('lexa-open');
      iframe.classList.remove('lexa-open');
      launcher.style.display = 'flex';
      setTimeout(function() { launcher.style.transform = ''; }, 10);
    }
  }

  launcher.addEventListener('click', toggleChat);
  overlay.addEventListener('click', toggleChat);

  document.body.appendChild(launcher);
  document.body.appendChild(iframe);
  document.body.appendChild(overlay);

  // Expose global API
  window.LexaChat = {
    open: function() { if (!isOpen) toggleChat(); },
    close: function() { if (isOpen) toggleChat(); },
    toggle: toggleChat
  };

})();
