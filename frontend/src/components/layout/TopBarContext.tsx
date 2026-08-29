import { createContext, useContext, useState, useCallback } from 'react';
import type React from 'react';

interface TopBarState {
  backLabel?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}

interface TopBarCtx {
  state: TopBarState;
  setBack: (label: string, onBack: () => void) => void;
  clearBack: () => void;
  setAction: (action: React.ReactNode) => void;
  clearAction: () => void;
}

const TopBarContext = createContext<TopBarCtx>({
  state: {},
  setBack: () => {},
  clearBack: () => {},
  setAction: () => {},
  clearAction: () => {},
});

export function TopBarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TopBarState>({});

  const setBack = useCallback((label: string, onBack: () => void) => {
    setState((s) => ({ ...s, backLabel: label, onBack }));
  }, []);

  const clearBack = useCallback(() => {
    setState((s) => ({ ...s, backLabel: undefined, onBack: undefined }));
  }, []);

  const setAction = useCallback((action: React.ReactNode) => {
    setState((s) => ({ ...s, action }));
  }, []);

  const clearAction = useCallback(() => {
    setState((s) => ({ ...s, action: undefined }));
  }, []);

  return (
    <TopBarContext.Provider value={{ state, setBack, clearBack, setAction, clearAction }}>
      {children}
    </TopBarContext.Provider>
  );
}

export const useTopBar = () => useContext(TopBarContext);
