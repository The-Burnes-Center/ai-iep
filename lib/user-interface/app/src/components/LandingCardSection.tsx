import React from "react";
import { useNavigate } from "react-router-dom";
import AIEPToolCard from "./AIEPToolCard";
import "./LandingCardSection.css";

const LandingCardSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-card-section">
      <AIEPToolCard
        topText="Try the"
        middleText="AIEP Tool"
        bottomText="to summarize or translate your IEP"
        onClick={() => navigate("/login")}
      />
    </div>
  );
};

export default LandingCardSection;
