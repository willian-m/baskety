// Metro resolves this file instead of index.ts on React Native platforms,
// wiring all components to their .native.tsx implementations.
export { Button } from "./components/Button/Button.native";
export type { ButtonProps } from "./components/Button/Button.native";

export { Card } from "./components/Card/Card.native";
export type { CardProps } from "./components/Card/Card.native";

export { TextInput } from "./components/TextInput/TextInput.native";
export type { TextInputProps } from "./components/TextInput/TextInput.native";

export { Badge } from "./components/Badge/Badge.native";
export type { BadgeProps, BadgeVariant } from "./components/Badge/Badge.native";
export { Avatar } from "./components/Avatar/Avatar.native";
export type { AvatarProps } from "./components/Avatar/Avatar.native";
export { Spinner } from "./components/Spinner/Spinner.native";
export type { SpinnerProps } from "./components/Spinner/Spinner.native";
export { ExpiryBadge } from "./components/ExpiryBadge/ExpiryBadge.native";
export type { ExpiryBadgeProps } from "./components/ExpiryBadge/ExpiryBadge.native";
