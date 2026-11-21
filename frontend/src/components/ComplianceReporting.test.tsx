import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ComplianceReporting } from "./ComplianceReporting";

const VALID_WALLET = "GAPTAQKSMN2ILFVHXDE5V274BUPC6QCRMJZYJFNGW7ENT2X3BQOS4M3C";

describe("ComplianceReporting wallet address validation (#1376)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows inline error and does not call fetch when wallet address is invalid", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<ComplianceReporting />);

    fireEvent.click(screen.getByRole("button", { name: /Form 8949/i }));
    const walletInput = screen.getByPlaceholderText("GABC123...");
    fireEvent.change(walletInput, { target: { value: "not-a-valid-wallet" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));

    expect(
      screen.getByText("Please enter a valid Stellar address (starts with G, 56 characters)")
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows empty wallet address for optional report types like csv export", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ success: true, data: { reportId: 10 } }),
    } as Response);

    render(<ComplianceReporting />);

    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/api/v1/compliance/csv-export");
  });

  it("submits when wallet address is a valid 56-character Stellar G-address", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({ success: true, data: { reportId: 11 } }),
    } as Response);

    render(<ComplianceReporting />);

    fireEvent.click(screen.getByRole("button", { name: /Form 8949/i }));
    const walletInput = screen.getByPlaceholderText("GABC123...");
    fireEvent.change(walletInput, { target: { value: VALID_WALLET } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    expect(String(fetchSpy.mock.calls[0][0])).toContain(VALID_WALLET);
  });
});
