import { ApiError, request, useLogin, useRegister, useUiStore } from "@baskety/core";
import type { HouseholdResponse } from "@baskety/core";
import { Button, TextInput } from "@baskety/ui";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function validate(name: string, email: string, password: string): string | null {
  if (!name.trim()) return "Name is required.";
  if (!email.trim() || !email.includes("@")) return "A valid email is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export default function RegisterScreen() {
  const router = useRouter();
  const registerMutation = useRegister();
  const login = useLogin();
  const setActiveHousehold = useUiStore((s) => s.setActiveHousehold);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const validationError = validate(name, email, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await registerMutation.mutateAsync({ name: name.trim(), email: email.trim(), password });
      // Auto-login — setSession is called by the mutation's onSuccess handler.
      await login.mutateAsync({ email: email.trim(), password });
      // Use core request() which reads token + base URL from the store.
      try {
        const households = await request<HouseholdResponse[]>("/households");
        if (households.length > 0) setActiveHousehold(households[0].id);
      } catch {
        // Non-fatal
      }
      router.replace("/(app)/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Baskety</Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput value={name} onChange={setName} placeholder="Your name" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChange={setPassword}
              placeholder="Min. 8 characters"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={loading ? "Creating account…" : "Create account"}
            onPress={handleRegister}
            disabled={loading}
          />
        </View>

        <Text style={styles.footer}>
          {"Already have an account? "}
          <Link href="/(auth)/login" style={styles.link}>
            Sign in
          </Link>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, justifyContent: "center", gap: 24 },
  header: { alignItems: "center", gap: 8 },
  logo: { fontSize: 36, fontWeight: "700" },
  subtitle: { fontSize: 16, color: "#6b7280" },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" },
  error: {
    color: "#ef4444",
    fontSize: 14,
    backgroundColor: "#fef2f2",
    padding: 10,
    borderRadius: 8,
  },
  footer: { textAlign: "center", fontSize: 14, color: "#6b7280" },
  link: { color: "#2563eb" },
});
