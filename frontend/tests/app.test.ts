import { describe, it, expect } from "vitest";
import App from "../src/App";

describe("App", () => {
  it("exports component", () => {
    expect(App).toBeTruthy();
  });
});
