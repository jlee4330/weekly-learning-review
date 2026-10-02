import { test, expect } from "@playwright/test";
test("English-only demo preserves drafts and reopens feedback", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Weekly Learning Review" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "한국어", exact: true })).toHaveCount(0);
  await expect(page.locator('[aria-label="Language"]')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('wlr-language','ko'));
  await page.reload();
  await page
    .getByRole("button", { name: "Start review", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Begin review", exact: true }).click();
  await page.getByLabel("Your answer").fill("이 초안은 다시 작성합니다");
  await page.getByRole("button", {name:"Rewrite answer"}).click();
  await expect(page.getByLabel("Your answer")).toHaveValue("");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await page.getByLabel("Your answer").fill("not sure");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "End review", exact: true }).click();
  await page.getByRole("button", { name: "Save & leave" }).click();
  await page.getByRole("button", { name: "Continue review" }).first().click();
  await page.getByRole("button", { name: "Continue conversation" }).click();
  await expect(page.getByLabel("Your answer")).toHaveValue(
    "not sure",
  );
  await page.getByRole("button", { name: "Finish answer" }).click();
  await expect(page.getByText("A little deeper · Follow-up")).toBeVisible();
  await page.screenshot({path:"tests/screenshots/review-followup.png",fullPage:true});
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  for (let i = 0; i < 6; i++) {
    if (
      await page.getByRole("heading", { name: "A little clearer, a little further." }).count()
    )
      break;
    await page
      .getByLabel("Your answer")
      .fill(
        "Pretrained models can adapt to tasks. For example, I would show retrieved sources so users can verify answers.",
      );
    await page.getByRole("button", { name: "Finish answer" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "A little clearer, a little further." }),
  ).toBeVisible();
  await expect(page.getByText("Illustrative feedback only.")).toBeVisible();
  await page.screenshot({path:"tests/screenshots/feedback.png",fullPage:true});
  await page.locator(".transcript summary").first().click();
  await expect(page.getByText("not sure", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to weekly reviews" }).click();
  await page.getByRole("button", { name: "View transcript" }).click();
  await expect(
    page.getByRole("heading", { name: "A little clearer, a little further." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("microphone denial and mobile layout", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start review", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Test microphone", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Microphone access is unavailable",
  );
  await page.getByRole("button", { name: "Begin review" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("screenshots desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1150 });
  await page.goto("/");
  await page.screenshot({
    path: "tests/screenshots/reviews-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button",{name:"Start review",exact:true}).first().click();
  await page.screenshot({path:"tests/screenshots/setup-desktop.png",fullPage:true});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({path:"tests/screenshots/setup-mobile.png",fullPage:true});
  await page.goto("/#overview");
  await expect(page.getByRole("heading",{name:"Weekly Learning Review"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Overview",exact:true})).toHaveCount(0);
  await page.screenshot({
    path: "tests/screenshots/reviews-mobile.png",
    fullPage: true,
  });
});
