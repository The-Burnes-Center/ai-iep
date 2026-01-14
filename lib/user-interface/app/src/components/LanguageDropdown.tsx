import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { SupportedLanguage } from '../common/language-context';
import './LanguageDropdown.css';

interface LanguageOption {
  value: string;
  label: string;
}

interface LanguageDropdownProps {
  language: string;
  languageOptions: LanguageOption[];
  onLanguageChange: (lang: SupportedLanguage) => void;
}

const LanguageDropdown: React.FC<LanguageDropdownProps> = ({ 
  language, 
  languageOptions, 
  onLanguageChange 
}) => {
  return (
    <div className="language-login-dropdown">
      <Dropdown>
        <Dropdown.Toggle variant="outline-secondary" size="sm">
          {languageOptions.find(opt => opt.value === language)?.label || 'Language'}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {languageOptions.map((option) => (
            <Dropdown.Item 
              key={option.value}
              onClick={() => onLanguageChange(option.value as SupportedLanguage)}
              active={language === option.value}
            >
              {option.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};

export default LanguageDropdown;