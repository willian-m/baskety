import React from "react";
import { View } from "react-native";

export interface CardProps {
  children: React.ReactNode;
}

export function Card({ children }: CardProps) {
  return <View>{children}</View>;
}
