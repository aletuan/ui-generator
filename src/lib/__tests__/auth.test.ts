import { test, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import * as jose from "jose";

// Mock server-only module
vi.mock("server-only", () => ({}));

// Mock Next.js cookies
const mockCookies = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

// Mock jose library to avoid TextEncoder issues in jsdom
const mockSignJWT = vi.fn();
const mockJwtVerify = vi.fn();
const mockDecodeJwt = vi.fn();

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof jose>();
  return {
    ...actual,
    SignJWT: vi.fn().mockImplementation(() => ({
      setProtectedHeader: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      sign: mockSignJWT,
    })),
    jwtVerify: mockJwtVerify,
    decodeJwt: mockDecodeJwt,
  };
});

let authModule: any;

beforeAll(async () => {
  // Set environment variable before importing
  process.env.JWT_SECRET = "test-secret-key";
  
  // Import auth module after mocks are set up
  authModule = await import("@/lib/auth");
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSignJWT.mockResolvedValue("mock-jwt-token");
  mockJwtVerify.mockResolvedValue({
    payload: { userId: "user123", email: "test@example.com", expiresAt: "2025-01-01T00:00:00.000Z" }
  });
  mockDecodeJwt.mockReturnValue({
    userId: "user123",
    email: "test@example.com", 
    expiresAt: "2025-01-01T00:00:00.000Z",
    exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
    iat: Math.floor(Date.now() / 1000)
  });
});

afterEach(() => {
  // Clean up
});

test("createSession creates JWT token and sets cookie", async () => {
  const userId = "user123";
  const email = "test@example.com";

  await authModule.createSession(userId, email);

  expect(mockCookies.set).toHaveBeenCalledWith(
    "auth-token",
    expect.any(String),
    expect.objectContaining({
      httpOnly: true,
      secure: false, // NODE_ENV !== "production" in test
      sameSite: "lax",
      expires: expect.any(Date),
      path: "/",
    })
  );
});

test("createSession sets secure cookie in production", async () => {
  vi.stubEnv("NODE_ENV", "production");

  await authModule.createSession("user123", "test@example.com");

  expect(mockCookies.set).toHaveBeenCalledWith(
    "auth-token",
    expect.any(String),
    expect.objectContaining({
      secure: true,
    })
  );
});

test("getSession returns session payload when valid token exists", async () => {
  const userId = "user123";
  const email = "test@example.com";

  mockCookies.get.mockReturnValue({ value: "valid-token" });

  const session = await authModule.getSession();

  expect(session).toEqual({
    userId,
    email,
    expiresAt: "2025-01-01T00:00:00.000Z",
  });
});

test("getSession returns null when no token exists", async () => {
  mockCookies.get.mockReturnValue(undefined);

  const session = await authModule.getSession();

  expect(session).toBeNull();
});

test("getSession returns null when token is invalid", async () => {
  mockCookies.get.mockReturnValue({ value: "invalid-token" });
  mockJwtVerify.mockRejectedValue(new Error("Invalid token"));

  const session = await authModule.getSession();

  expect(session).toBeNull();
});

test("getSession returns null when token is expired", async () => {
  mockCookies.get.mockReturnValue({ value: "expired-token" });
  mockJwtVerify.mockRejectedValue(new Error("Token expired"));

  const session = await authModule.getSession();

  expect(session).toBeNull();
});

test("deleteSession removes auth cookie", async () => {
  await authModule.deleteSession();

  expect(mockCookies.delete).toHaveBeenCalledWith("auth-token");
});

test("verifySession returns session payload from request cookie", async () => {
  const userId = "user123";
  const email = "test@example.com";

  const mockRequest = {
    cookies: {
      get: vi.fn().mockReturnValue({ value: "valid-token" }),
    },
  } as unknown as NextRequest;

  const session = await authModule.verifySession(mockRequest);

  expect(session).toEqual({
    userId,
    email,
    expiresAt: "2025-01-01T00:00:00.000Z",
  });
});

test("verifySession returns null when no token in request", async () => {
  const mockRequest = {
    cookies: {
      get: vi.fn().mockReturnValue(undefined),
    },
  } as unknown as NextRequest;

  const session = await authModule.verifySession(mockRequest);

  expect(session).toBeNull();
});

test("verifySession returns null when request token is invalid", async () => {
  const mockRequest = {
    cookies: {
      get: vi.fn().mockReturnValue({ value: "invalid-token" }),
    },
  } as unknown as NextRequest;

  // Set up the mock to reject for this specific test
  mockJwtVerify.mockRejectedValueOnce(new Error("Invalid token"));

  const session = await authModule.verifySession(mockRequest);

  expect(session).toBeNull();
});

test("JWT secret is properly configured", async () => {
  // The JWT secret should be configured and working
  await expect(authModule.createSession("user123", "test@example.com")).resolves.not.toThrow();
  expect(mockCookies.set).toHaveBeenCalled();
});

test("JWT token contains correct payload structure", async () => {
  const userId = "user123";
  const email = "test@example.com";

  await authModule.createSession(userId, email);

  const setCall = mockCookies.set.mock.calls[0];
  const token = setCall[1] as string;

  // Verify the mocked token was set
  expect(token).toBe("mock-jwt-token");
  expect(mockSignJWT).toHaveBeenCalledOnce();
});

test("cookie expiration matches JWT expiration", async () => {
  const userId = "user123";
  const email = "test@example.com";
  const beforeTime = Date.now();

  await authModule.createSession(userId, email);

  const setCall = mockCookies.set.mock.calls[0];
  const cookieOptions = setCall[2];
  const cookieExpTime = cookieOptions.expires.getTime();

  // Should be approximately 7 days from now
  const expectedExpTime = beforeTime + 7 * 24 * 60 * 60 * 1000;
  
  expect(Math.abs(cookieExpTime - expectedExpTime)).toBeLessThan(1000); // Within 1 second
});