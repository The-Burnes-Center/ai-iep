// Google Analytics helper functions
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export const trackPageView = (page_path: string, page_title?: string) => {
  if (typeof window !== 'undefined' && window.gtag && process.env.NODE_ENV === 'production') {
    window.gtag('config', 'G-HR9GBXHLMK', {
      page_path,
      page_title,
    });
  } else if (process.env.NODE_ENV !== 'production') {
    // console.log(`Analytics: Skipping tracking for ${page_path} (non-production environment)`);
  }
};

export const trackEvent = (action: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag && process.env.NODE_ENV === 'production') {
    window.gtag('event', action, parameters);
  } else if (process.env.NODE_ENV !== 'production') {
    // console.log(`Analytics: Skipping event tracking for ${action} (non-production environment)`);
  }
};