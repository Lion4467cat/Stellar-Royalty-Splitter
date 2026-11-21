/**
 * Oracle prediction route validation tests — closes #1380.
 */
import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const mockGetLatestPrediction = jest.fn();
const mockStorePrediction = jest.fn();
let currentRole = "admin";

await jest.unstable_mockModule("../src/database/index.js", () => ({
  storePrediction: mockStorePrediction,
  getLatestPrediction: mockGetLatestPrediction,
  getPredictionHistory: jest.fn(() => []),
  storeModelMetadata: jest.fn(),
  getLatestModelMetadata: jest.fn(),
  getModelMetadata: jest.fn(),
  storeMarketData: jest.fn(),
  getLatestMarketData: jest.fn(),
  getMarketDataHistory: jest.fn(() => []),
  calculatePredictionAccuracy: jest.fn(),
  getMarketTrends: jest.fn(() => []),
}));

await jest.unstable_mockModule("../src/middleware/rbac.js", () => ({
  attachRole: (req, _res, next) => {
    req.role = currentRole;
    next();
  },
  requireRole: () => (req, res, next) => {
    if (req.role === "forbidden") {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  },
}));

await jest.unstable_mockModule("../src/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const express = (await import("express")).default;
const { oracleRouter } = await import("../src/routes/oracle.js");

const app = express();
app.use(express.json());
app.use("/api/v1", oracleRouter);

const VALID_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("Oracle prediction routes — contractId validation (#1380)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentRole = "admin";
  });

  test("POST /api/v1/oracle/predict rejects invalid contractId with 400", async () => {
    const res = await request(app)
      .post("/api/v1/oracle/predict")
      .send({
        contractId: "not-a-contract",
        predictedAmount: 1500,
        confidence: 0.92,
        factors: { volume: 10 },
        modelVersion: "v1.0.0",
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code || res.body.code).toBe("invalid_contract_id");
    expect(mockStorePrediction).not.toHaveBeenCalled();
  });

  test("POST /api/v1/oracle/predict rejects G-address or malformed C-address with 400", async () => {
    for (const badId of [
      "GAPTAQKSMN2ILFVHXDE5V274BUPC6QCRMJZYJFNGW7ENT2X3BQOS4M3C",
      "CSHORT",
    ]) {
      const res = await request(app)
        .post("/api/v1/oracle/predict")
        .send({
          contractId: badId,
          predictedAmount: 1500,
          confidence: 0.92,
          factors: { volume: 10 },
          modelVersion: "v1.0.0",
        });

      expect(res.status).toBe(400);
      expect(mockStorePrediction).not.toHaveBeenCalled();
    }
  });

  test("POST /api/v1/oracle/predict accepts valid Soroban contractId", async () => {
    mockStorePrediction.mockReturnValue(42);

    const res = await request(app)
      .post("/api/v1/oracle/predict")
      .send({
        contractId: VALID_CONTRACT_ID,
        predictedAmount: 1500,
        confidence: 0.92,
        factors: { volume: 10 },
        modelVersion: "v1.0.0",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.predictionId).toBe(42);
    expect(mockStorePrediction).toHaveBeenCalledTimes(1);
  });

  test("GET /api/v1/oracle/predict/:contractId rejects invalid contractId with 400", async () => {
    const res = await request(app).get("/api/v1/oracle/predict/not-a-contract");

    expect(res.status).toBe(400);
    expect(res.body.error?.code || res.body.code).toBe("invalid_contract_id");
    expect(mockGetLatestPrediction).not.toHaveBeenCalled();
  });

  test("GET /api/v1/oracle/predict/:contractId returns prediction for valid contractId", async () => {
    mockGetLatestPrediction.mockReturnValue({
      id: 1,
      contract_id: VALID_CONTRACT_ID,
      predicted_amount: 1500,
      confidence: 0.92,
      factors: JSON.stringify({ volume: 10 }),
      model_version: "v1.0.0",
      prediction_horizon: "7d",
    });

    const res = await request(app).get(`/api/v1/oracle/predict/${VALID_CONTRACT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.prediction.contract_id).toBe(VALID_CONTRACT_ID);
    expect(res.body.prediction.factors).toEqual({ volume: 10 });
    expect(mockGetLatestPrediction).toHaveBeenCalledWith(VALID_CONTRACT_ID, "7d");
  });
});
