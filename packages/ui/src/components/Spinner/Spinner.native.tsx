import { Text } from "react-native";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

export function Spinner(_props: SpinnerProps) {
  return <Text>Loading…</Text>;
}
