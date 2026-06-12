import NetInfo from "@react-native-community/netinfo";
import { useUiStore } from "@baskety/core";
import { useEffect } from "react";

export interface NetworkProfile {
  ssid: string;
  localUrl: string;
}

/**
 * Reads the active WiFi SSID via NetInfo.
 * If it matches a saved network profile, sets the local URL as activeServerUrl.
 * Falls back to the externalUrl stored in the Zustand store.
 * Returns the currently resolved server URL.
 */
export function useServerUrl(
  profiles: NetworkProfile[] = [],
  externalUrl: string | null = null,
): string | null {
  const setActiveServerUrl = useUiStore((s) => s.setActiveServerUrl);
  const activeServerUrl = useUiStore((s) => s.activeServerUrl);

  useEffect(() => {
    let cancelled = false;

    async function resolveUrl() {
      const state = await NetInfo.fetch();
      if (cancelled) return;

      if (state.type === "wifi" && state.details?.ssid) {
        const ssid = state.details.ssid;
        const match = profiles.find((p) => p.ssid === ssid);
        if (match) {
          setActiveServerUrl(match.localUrl);
          return;
        }
      }
      setActiveServerUrl(externalUrl);
    }

    void resolveUrl();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (cancelled) return;
      if (state.type === "wifi" && state.details?.ssid) {
        const ssid = state.details.ssid;
        const match = profiles.find((p) => p.ssid === ssid);
        if (match) {
          setActiveServerUrl(match.localUrl);
          return;
        }
      }
      setActiveServerUrl(externalUrl);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profiles, externalUrl, setActiveServerUrl]);

  return activeServerUrl;
}
