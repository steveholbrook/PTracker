import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "ptracker-rules-test",
    firestore: {
      rules: fs.readFileSync(
        path.resolve("firebase/firestore.rules"),
        "utf8",
      ),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "projects", "p1"), {
      id: "p1",
      name: "Test Project",
      code: "TEST",
    });
    await setDoc(doc(db, "projects", "p1", "members", "pm"), {
      userId: "pm",
      email: "pm@demo.invalid",
      role: "PROJECT_MANAGER",
    });
    await setDoc(doc(db, "projects", "p1", "members", "customer"), {
      userId: "customer",
      email: "customer@demo.invalid",
      role: "CUSTOMER_VIEWER",
    });
    await setDoc(doc(db, "projects", "p1", "forecastBaselines", "b1"), {
      id: "b1",
      status: "APPROVED",
    });
    await setDoc(doc(db, "projects", "p1", "forecastLines", "f1"), {
      id: "f1",
      baselineId: "b1",
      dayRate: 1000,
    });
    await setDoc(doc(db, "projects", "p1", "auditLog", "a1"), {
      id: "a1",
      userId: "pm",
      projectId: "p1",
      action: "TEST",
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore project isolation", () => {
  it("allows a PM to read internal forecast data", async () => {
    const db = testEnv.authenticatedContext("pm").firestore();
    await assertSucceeds(
      getDoc(doc(db, "projects", "p1", "forecastLines", "f1")),
    );
  });

  it("denies customer viewers access to rates", async () => {
    const db = testEnv.authenticatedContext("customer").firestore();
    await assertFails(
      getDoc(doc(db, "projects", "p1", "forecastLines", "f1")),
    );
  });

  it("keeps approved baselines immutable", async () => {
    const db = testEnv.authenticatedContext("pm").firestore();
    await assertFails(
      updateDoc(doc(db, "projects", "p1", "forecastBaselines", "b1"), {
        status: "SUPERSEDED",
      }),
    );
  });

  it("keeps audit entries append-only", async () => {
    const db = testEnv.authenticatedContext("pm").firestore();
    await assertFails(
      updateDoc(doc(db, "projects", "p1", "auditLog", "a1"), {
        action: "ALTERED",
      }),
    );
  });
});
