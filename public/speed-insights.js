/**
 * Vercel Speed Insights initialization
 * This module loads and initializes Vercel Speed Insights for tracking web vitals
 */

// Initialize the speed insights queue
window.si = window.si || function() {
  (window.siq = window.siq || []).push(arguments);
};

// Load the Speed Insights script
(function() {
  const script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  
  // Append to head for optimal loading
  const target = document.head || document.getElementsByTagName('head')[0];
  target.appendChild(script);
  
  // Optional: Log in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[Speed Insights] Initialized (metrics only tracked in production)');
  }
})();
