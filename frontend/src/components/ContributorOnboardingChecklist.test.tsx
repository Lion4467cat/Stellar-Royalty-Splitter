import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContributorOnboardingChecklist } from "./ContributorOnboardingChecklist";
import { api } from "../api";

vi.mock("../api", () => ({
  api: {
    getOnboardingStatus: vi.fn(),
    updateOnboardingEmail: vi.fn(),
    updateOnboardingChecklistItem: vi.fn(),
    sendOnboardingTestReminder: vi.fn(),
  },
}));

describe("ContributorOnboardingChecklist (#1378)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getOnboardingStatus).mockResolvedValue({
      walletAddress: "GAPTAQKSMN2ILFVHXDE5V274BUPC6QCRMJZYJFNGW7ENT2X3BQOS4M3C",
      email: "dev@example.com",
      kycStatus: "pending",
      payoutToken: "XLM",
      paymentPreferencesSet: false,
      taxInfoSubmitted: false,
      items: [
        {
          id: "wallet_connected",
          label: "Wallet connected",
          description: "Connect a Stellar wallet",
          completed: true,
          required: true,
          category: "setup",
        },
      ],
      completedCount: 1,
      totalCount: 5,
      completionPercentage: 20,
      requiredComplete: false,
      actionsLocked: true,
      nextStep: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the demo state switcher in development mode", async () => {
    vi.stubEnv("DEV", true);

    render(
      <ContributorOnboardingChecklist walletAddress="GAPTAQKSMN2ILFVHXDE5V274BUPC6QCRMJZYJFNGW7ENT2X3BQOS4M3C" />
    );

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-demo-controls")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "100%" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText(/All Required Steps Complete! Payout Actions Unlocked/i)).toBeInTheDocument();
  });

  it("hides the demo state switcher in production builds (DEV=false)", async () => {
    vi.stubEnv("DEV", false);

    render(
      <ContributorOnboardingChecklist walletAddress="GAPTAQKSMN2ILFVHXDE5V274BUPC6QCRMJZYJFNGW7ENT2X3BQOS4M3C" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Contributor Onboarding/i)).toBeInTheDocument();
    });

    expect(screen.queryByTestId("onboarding-demo-controls")).not.toBeInTheDocument();
    expect(screen.queryByText("Test State:")).not.toBeInTheDocument();
  });
});
