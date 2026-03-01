// @vitest-environment jsdom

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePhoto } from "@/test/fixtures";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => <div aria-label={alt ?? "mock-image"} />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PhotoCard } from "@/components/photo-card";

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("PhotoCard", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createStorageMock(),
      configurable: true,
    });
  });

  it("toggles like state and persists count in localStorage", async () => {
    const user = userEvent.setup();
    render(<PhotoCard photo={makePhoto({ slug: "first-shot" })} />);

    const likeButton = screen.getByRole("button", { name: "좋아요" });
    expect(likeButton).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();

    await user.click(likeButton);

    expect(screen.getByRole("button", { name: "좋아요 취소" })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(window.localStorage.getItem("photo_blog_likes")).toBe('["first-shot"]');
    expect(window.localStorage.getItem("photo_blog_like_counts")).toBe('{"first-shot":1}');

    await user.click(screen.getByRole("button", { name: "좋아요 취소" }));

    expect(screen.getByRole("button", { name: "좋아요" })).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(window.localStorage.getItem("photo_blog_like_counts")).toBe('{"first-shot":0}');
  });

  it("renders download link for slug", () => {
    render(<PhotoCard photo={makePhoto({ slug: "han-river" })} />);

    const downloadLink = screen.getByRole("link", { name: "사진 다운로드" });
    expect(downloadLink).toHaveAttribute("href", "/api/photos/han-river/download");
  });
});
