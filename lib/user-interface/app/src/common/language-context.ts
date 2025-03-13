import React, { createContext, useState, useContext, useEffect } from 'react';
import { StorageHelper } from './helpers/storage-helper';

// Define supported languages
export type SupportedLanguage = 'en' | 'es' | 'zh' | 'vi';

// Define the context type
interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
}

// Create the context with default values
export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

// Language context storage key
const LANGUAGE_STORAGE_KEY = 'aiep-language-preference';

// Create the provider component
export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  // Initialize with stored preference or default to English
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const stored = StorageHelper.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage;
    return stored || 'en';
  });
  
  // Initialize with empty translations
  const [translations, setTranslations] = useState<Record<string, string>>({});

  // Update language and store preference
  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    StorageHelper.setItem(LANGUAGE_STORAGE_KEY, lang);
    loadTranslations(lang);
  };

  // Load translations for the current language
  const loadTranslations = async (lang: SupportedLanguage) => {
    try {
      // Dynamic import to load only the needed language file
      const translationModule = await import(`../translations/${lang}.json`);
      setTranslations(translationModule.default);
    } catch (error) {
      console.error(`Failed to load translations for ${lang}:`, error);
      // Fallback to English if translation file is missing
      if (lang !== 'en') {
        const fallbackModule = await import('../translations/en.json');
        setTranslations(fallbackModule.default);
      }
    }
  };

  // Load translations on initial render
  useEffect(() => {
    loadTranslations(language);
  }, []);

  // Translation function
  const t = (key: string): string => {
    return translations[key] || key;
  };

// Alternative return statement
const contextValue = { language, setLanguage, t };
return React.createElement(LanguageContext.Provider, { value: contextValue }, children);
};

// Custom hook for using the language context
export const useLanguage = () => useContext(LanguageContext);