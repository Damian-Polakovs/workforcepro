import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { defaultDemoProfiles } from "~/config/demo";

import {
  defaultMobileViewerEmail,
  getActiveViewerEmail,
  setActiveViewerEmail,
} from "./session-store";

type DemoSessionContextValue = {
  ready: boolean;
  viewerEmail: string;
  setViewerEmail: (email: string) => Promise<void>;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider(props: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [viewerEmail, setViewerEmailState] =
    useState<string>(defaultMobileViewerEmail);

  useEffect(() => {
    let mounted = true;

    void getActiveViewerEmail().then((storedEmail) => {
      if (!mounted) {
        return;
      }

      setViewerEmailState(storedEmail ?? defaultMobileViewerEmail);
      setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<DemoSessionContextValue>(
    () => ({
      ready,
      async setViewerEmail(email) {
        setViewerEmailState(email);
        await setActiveViewerEmail(email);
      },
      viewerEmail,
    }),
    [ready, viewerEmail],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {props.children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession() {
  const value = useContext(DemoSessionContext);

  if (!value) {
    throw new Error("useDemoSession must be used inside DemoSessionProvider");
  }

  return {
    ...value,
    profiles: defaultDemoProfiles,
  } as DemoSessionContextValue & {
    profiles: typeof defaultDemoProfiles;
  };
}
