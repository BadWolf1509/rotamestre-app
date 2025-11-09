import React, { createContext, useContext, useState } from 'react';

import { DrawerMenu } from '@/components/DrawerMenu';

interface DrawerMenuContextValue {
  openDrawer: () => void;
  closeDrawer: () => void;
}

const DrawerMenuContext = createContext<DrawerMenuContextValue | undefined>(undefined);

export function DrawerMenuProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const openDrawer = () => setVisible(true);
  const closeDrawer = () => setVisible(false);

  return (
    <DrawerMenuContext.Provider value={{ openDrawer, closeDrawer }}>
      <DrawerMenu visible={visible} onClose={closeDrawer} />
      {children}
    </DrawerMenuContext.Provider>
  );
}

export function useDrawerMenu() {
  const context = useContext(DrawerMenuContext);
  if (!context) {
    throw new Error('useDrawerMenu must be used within DrawerMenuProvider');
  }
  return context;
}
