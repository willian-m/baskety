import NetInfo from "@react-native-community/netinfo";
import { useUiStore } from "@baskety/core";
import { useEffect } from "react";

export function useServerUrl(): string | null {
  const networkProfiles = useUiStore((s) => s.networkProfiles);
  const externalUrl = useUiStore((s) => s.externalUrl);
  const setActiveServerUrl = useUiStore((s) => s.setActiveServerUrl);
  const activeServerUrl = useUiStore((s) => s.activeServerUrl);

  useEffect(() => {
    let cancelled = false;

    NetInfo.configure({ shouldFetchWiFiSSID: true });

    function resolve(ssid: string | null): void {
      if (cancelled) return;
      if (ssid) {
        const match = networkProfiles.find((p) => p.ssids.includes(ssid));
        if (match) {
          setActiveServerUrl(match.serverUrl);
          return;
        }
      }
      setActiveServerUrl(externalUrl);
    }

    async function resolveFromCurrentState(): Promise<void> {
      const state = await NetInfo.fetch();
      if (cancelled) return;
      const ssid =
        state.type === "wifi" && state.details?.ssid ? state.details.ssid : null;
      resolve(ssid);
    }

    void resolveFromCurrentState();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const ssid =
        state.type === "wifi" && state.details?.ssid ? state.details.ssid : null;
      resolve(ssid);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [networkProfiles, externalUrl, setActiveServerUrl]);

  return activeServerUrl;
}
