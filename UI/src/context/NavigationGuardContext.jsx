import { createContext, useContext, useState } from 'react';

const NavigationGuardContext = createContext({ blocked: false, setBlocked: () => {} });

export function NavigationGuardProvider({ children }) {
  const [blocked, setBlocked] = useState(false);
  return (
    <NavigationGuardContext.Provider value={{ blocked, setBlocked }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export const useNavigationGuard = () => useContext(NavigationGuardContext);
