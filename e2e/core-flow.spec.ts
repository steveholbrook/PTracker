import { expect, test } from "@playwright/test";

test("administrator can enter demo and navigate the core modules", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore as Administrator" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole("button", { name: /Open workspace/i }).first().click();
  await expect(page.getByRole("heading", { name: "Executive dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "POAP" }).first().click();
  await expect(page.getByRole("heading", { name: "POAP delivery plan" })).toBeVisible();
  await page.getByRole("link", { name: "Actuals" }).first().click();
  await expect(page.getByRole("heading", { name: "Actual effort" })).toBeVisible();
});

