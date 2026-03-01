// @vitest-environment jsdom

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAdminSessionMock } = vi.hoisted(() => ({
  useAdminSessionMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/admin-auth-client", () => ({
  useAdminSession: useAdminSessionMock,
}));

import { AdminAuthActions } from "@/components/admin-auth-actions";

describe("AdminAuthActions", () => {
  const signInWithGitHub = vi.fn();
  const signOut = vi.fn();

  beforeEach(() => {
    signInWithGitHub.mockReset();
    signOut.mockReset();
  });

  it("shows login button for anonymous user", async () => {
    const user = userEvent.setup();
    useAdminSessionMock.mockReturnValue({
      hasAuthConfig: true,
      isAuthenticated: false,
      isAdmin: false,
      authStatus: "idle",
      authError: null,
      signInWithGitHub,
      signOut,
    });

    render(<AdminAuthActions />);

    await user.click(screen.getByRole("button", { name: "GitHub 로그인" }));
    expect(signInWithGitHub).toHaveBeenCalledWith("/");
  });

  it("shows admin actions for authenticated admin", async () => {
    const user = userEvent.setup();
    useAdminSessionMock.mockReturnValue({
      hasAuthConfig: true,
      isAuthenticated: true,
      isAdmin: true,
      authStatus: "idle",
      authError: null,
      signInWithGitHub,
      signOut,
    });

    render(<AdminAuthActions />);

    expect(screen.getByRole("link", { name: "Upload" })).toHaveAttribute("href", "/admin/upload");
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute("href", "/admin/photos");

    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("renders auth error message", () => {
    useAdminSessionMock.mockReturnValue({
      hasAuthConfig: false,
      isAuthenticated: false,
      isAdmin: false,
      authStatus: "error",
      authError: "로그인 실패",
      signInWithGitHub,
      signOut,
    });

    render(<AdminAuthActions />);

    expect(screen.getByText("로그인 실패")).toBeInTheDocument();
  });
});
