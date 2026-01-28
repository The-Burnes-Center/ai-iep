import React from 'react';
import './AIEPHub.css';

interface AIEPHubProps {
  NavigationComponent?: React.ComponentType;
}

export default function AIEPHub({ NavigationComponent }: AIEPHubProps) {
  return (
    <div>
      {NavigationComponent && <NavigationComponent />}
      <div>Hello World</div>
    </div>
  );
}
