// @vitest-environment jsdom

import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HomeNavDrawer } from "@/components/home-nav-drawer";

describe("HomeNavDrawer", () => {
  it("opens and closes drawer via button and escape key", async () => {
    const user = userEvent.setup();

    render(<HomeNavDrawer />);

    await user.click(screen.getByRole("button", { name: "메뉴 열기" }));

    expect(screen.getByRole("link", { name: /Feed/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Graph View/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    const drawerRoot = document.getElementById("home-drawer")?.parentElement;
    expect(drawerRoot).toHaveAttribute("aria-hidden", "true");
  });

  it("closes when overlay is clicked", async () => {
    const user = userEvent.setup();
    render(<HomeNavDrawer />);

    await user.click(screen.getByRole("button", { name: "메뉴 열기" }));
    await user.click(screen.getByRole("button", { name: "메뉴 닫기" }));

    const drawerRoot = document.getElementById("home-drawer")?.parentElement;
    expect(drawerRoot).toHaveAttribute("aria-hidden", "true");
  });
});
