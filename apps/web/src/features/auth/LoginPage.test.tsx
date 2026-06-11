import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage.js";

const { mockLoginMutateAsync } = vi.hoisted(() => ({
  mockLoginMutateAsync: vi.fn(),
}));

vi.mock("@baskety/core", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
  useLogin: () => ({ mutateAsync: mockLoginMutateAsync, isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

describe("LoginPage", () => {
  it("renders the login form", () => {
    mockLoginMutateAsync.mockResolvedValue({ token: "test-token", expires_at: null });
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows validation error for empty email on submit", async () => {
    mockLoginMutateAsync.mockResolvedValue({ token: "test-token", expires_at: null });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });

  it("shows validation error for invalid email", async () => {
    mockLoginMutateAsync.mockResolvedValue({ token: "test-token", expires_at: null });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), "notanemail");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });

  it("shows password required validation error", async () => {
    mockLoginMutateAsync.mockResolvedValue({ token: "test-token", expires_at: null });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it("shows API error when login fails", async () => {
    const { ApiError } = await import("@baskety/core");
    mockLoginMutateAsync.mockRejectedValue(new ApiError(401, "Invalid credentials"));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
