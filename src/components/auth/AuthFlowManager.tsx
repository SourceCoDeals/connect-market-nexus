
import React from 'react';

// Ultra-simple auth flow - no competing state management
// Let nuclear auth and protected routes handle everything
export const AuthFlowManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // No auth flow management - just render children
  return <>{children}</>;
};
