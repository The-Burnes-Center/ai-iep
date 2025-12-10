import './AuthHeader.css';
interface AuthHeaderProps {
  title: string;
  logoSrc?: string;
  logoAlt?: string;
  className?: string;
  showLogo?: boolean;
}

const AuthHeader: React.FC<AuthHeaderProps> = ({ 
  title, 
  logoSrc = "/images/aiep-logo-vertical.svg",
  logoAlt = "AIEP Logo",
  className = '',
  showLogo = true
}) => {
  return (
    <div className={`text-center mb-4 ${className}`}>
      {showLogo && (
        <img 
          src={logoSrc} 
          alt={logoAlt} 
          className="aiep-logo mb-3" 
        />
      )}
      <h4>{title}</h4>
    </div>
  );
};

export default AuthHeader;