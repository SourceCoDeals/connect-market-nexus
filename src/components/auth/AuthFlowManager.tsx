
import React from 'react';

// Nuclear simplification: Remove ALL auth flow management
// Let the auth system and protected routes handle everything
export const AuthFlowManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // No auth flow management - just render children
  return <>{children}</>;
};
