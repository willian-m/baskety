import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RegisterPage } from "./RegisterPage.js";

const { mockLoginMutateAsync, mockRegisterMutateAsync } = vi.hoisted(() => ({
  mockLoginMutateAsync: vi.fn(),
  mockRegisterMutateAsync: vi.fn(),
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
  useRegister: () => ({ mutateAsync: mockRegisterMutateAsync, isPending: false }),
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

describe("RegisterPage", () => {
  it("renders the registration form", () => {
    mockRegisterMutateAsync.mockResolvedValue({ id: "user-1", name: "Test", email: "t@t.com" });
    mockLoginMutateAsync.mockResolvedValue({ token: "test-token", expires_at: null });
    render(<RegisterPage />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows validation error for short password", async () => {
    mockRegisterMutateAsync.mockResolvedValue({ id: "user-1", name: "Test", email: "t@t.com" });
    mockLoginMutateAsync.mockResolvedValue({ token: "test-token", expires_at: null });
    const user = userEvent.setup();
    render(<RegisterPage />);
    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("shows validation error for invalid email", async () => {
    mockRegisterMutateAsync.mockResolvedValue({ id: "user-1", name: "Test", email: "t@t.com" });
    mockLoginMutateAsync.mockResolvedValue({ token: "test-token", expires_at: null });
    const user = userEvent.setup();
    render(<RegisterPage />);
    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "bademail");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });

  it("shows API error when registration fails", async () => {
    const { ApiError } = await import("@baskety/core");
    mockRegisterMutateAsync.mockRejectedValue(new ApiError(409, "Email already in use"));
    mockLoginMutateAsync.mockResolvedValue({ token: "test-token", expires_at: null });
    const user = userEvent.setup();
    render(<RegisterPage />);
    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/email already in use/i)).toBeInTheDocument();
  });
});
