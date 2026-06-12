import { useUiStore, isValidUrl } from "@baskety/core";
import type { NetworkProfile } from "@baskety/core";
import { Button, TextInput } from "@baskety/ui";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

export default function OnboardingScreen() {
  const router = useRouter();
  const persistExternalUrl = useUiStore((s) => s.setExternalUrl);
  const addProfile = useUiStore((s) => s.addProfile);

  const [externalUrl, setExternalUrl] = useState("");
  const [ssid, setSsid] = useState("");
  const [label, setLabel] = useState("");
  const [localUrl, setLocalUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localUrlError, setLocalUrlError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function handleGetStarted() {
    const trimmed = externalUrl.trim();
    if (!trimmed) {
      setError("Server URL is required.");
      return;
    }
    if (!isValidUrl(trimmed)) {
      setError("URL must start with http:// or https:// and have a valid host.");
      return;
    }

    const ssidTrimmed = ssid.trim();
    const localUrlTrimmed = localUrl.trim();
    // "Both or neither" — a home-network profile needs both fields.
    if (Boolean(ssidTrimmed) !== Boolean(localUrlTrimmed)) {
      setLocalUrlError("Provide both WiFi name and local URL, or leave both empty.");
      return;
    }
    if (ssidTrimmed && localUrlTrimmed && !isValidUrl(localUrlTrimmed)) {
      setLocalUrlError("Local URL must start with http:// or https:// and have a valid host.");
      return;
    }

    setError(null);
    setLocalUrlError(null);

    const base = trimmed.replace(/\/+$/, "");
    setIsChecking(true);
    try {
      const res = await fetch(base + "/healthz", {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        setError("Cannot reach server. Check the URL and try again.");
        setIsChecking(false);
        return;
      }
    } catch {
      setError("Cannot reach server. Check the URL and try again.");
      setIsChecking(false);
      return;
    }
    setIsChecking(false);

    persistExternalUrl(trimmed);
    // Persist optional home-network profile
    if (ssidTrimmed && localUrlTrimmed) {
      const profile: NetworkProfile = {
        id: crypto.randomUUID(),
        label: label.trim() || "Home",
        ssids: [ssidTrimmed],
        serverUrl: localUrlTrimmed,
      };
      addProfile(profile);
    }
    router.replace("/(auth)/login");
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>Baskety</Text>
          <Text style={styles.subtitle}>Self-hosted grocery management</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Server URL</Text>
          <Text style={styles.hint}>The address where your Baskety server is running.</Text>
          <TextInput
            value={externalUrl}
            onChange={(v) => {
              setExternalUrl(v);
              setError(null);
            }}
            placeholder="https://baskety.example.com"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Home Network (optional)</Text>
          <Text style={styles.hint}>Use a faster local URL when connected to your home WiFi.</Text>
          <TextInput
            value={ssid}
            onChange={(v) => {
              setSsid(v);
              setLocalUrlError(null);
            }}
            placeholder="WiFi network name (SSID)"
          />
          {ssid.trim() ? (
            <>
              <View style={styles.spacer} />
              <Text style={styles.fieldLabel}>Profile Name</Text>
              <TextInput value={label} onChange={setLabel} placeholder="e.g. Home" />
            </>
          ) : null}
          <View style={styles.spacer} />
          <TextInput
            value={localUrl}
            onChange={(v) => {
              setLocalUrl(v);
              setLocalUrlError(null);
            }}
            placeholder="http://192.168.1.10:8080"
          />
          {localUrlError ? <Text style={styles.error}>{localUrlError}</Text> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Get Started"
          onPress={handleGetStarted}
          loading={isChecking}
          disabled={isChecking}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    gap: 24,
  },
  header: { alignItems: "center", gap: 8 },
  logo: { fontSize: 36, fontWeight: "700" },
  subtitle: { fontSize: 16, color: "#6b7280" },
  section: { gap: 8 },
  label: { fontSize: 16, fontWeight: "600" },
  fieldLabel: { fontSize: 14, fontWeight: "500" },
  hint: { fontSize: 13, color: "#6b7280" },
  spacer: { height: 8 },
  error: { color: "#ef4444", fontSize: 14 },
});
