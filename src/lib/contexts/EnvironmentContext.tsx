import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface EnvironmentContextType {
  legacy: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [legacy, setLegacy] = useState<boolean>(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const legacyParam = searchParams.get('legacy');
    setLegacy(legacyParam === 'true');
  }, []);

  return (
    <EnvironmentContext.Provider value={{ legacy }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
}

