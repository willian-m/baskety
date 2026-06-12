import { request } from "@playwright/test";

export default async function globalSetup() {
  const api = await request.newContext({ baseURL: "http://localhost:8080" });

  // Register — ignore 409 (already exists from prior run)
  await api.post("/api/v1/auth/register", {
    data: { email: "e2e-user@baskety.test", name: "E2E User", password: "E2eP@ss123" },
  });

  const loginRes = await api.post("/api/v1/auth/login", {
    data: { email: "e2e-user@baskety.test", password: "E2eP@ss123" },
  });
  const loginBody = await loginRes.json();
  const token: string = loginBody.data.token;

  const hhRes = await api.get("/api/v1/households", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const hhBody = await hhRes.json();
  let householdId: string;
  if (hhBody.data && hhBody.data.length > 0) {
    householdId = hhBody.data[0].id as string;
  } else {
    const createHhRes = await api.post("/api/v1/households", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { name: "E2E Household" },
    });
    const createHhBody = await createHhRes.json();
    householdId = createHhBody.data.id as string;
  }

  process.env.E2E_TOKEN = token;
  process.env.E2E_HOUSEHOLD_ID = householdId;

  await api.dispose();
}
