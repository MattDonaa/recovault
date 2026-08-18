import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the application heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: /RecoVault/i }),
    ).toBeInTheDocument();
  });

  it("communicates the mock-first foundation state", () => {
    render(<HomePage />);
    expect(screen.getByTestId("app-env")).toHaveTextContent(/Environment:/i);
    expect(screen.getByText(/mock-first/i)).toBeInTheDocument();
  });
});
