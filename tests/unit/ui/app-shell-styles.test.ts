import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("shared app shell styles", () => {
  it("should keep checkbox controls compact when applying shared form styles", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

    expect(css).toMatch(
      /input\[type="checkbox"\],\s*input\[type="radio"\]\s*\{[\s\S]*width:\s*auto;[\s\S]*padding:\s*0;[\s\S]*\}/
    );
  });

  it("should keep checkbox labels and controls grouped in the options layout", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");
    const optionsApp = readFileSync(resolve(process.cwd(), "src/ui/options/App.tsx"), "utf8");

    expect(optionsApp).toContain('className="field__toggle-control"');
    expect(css).toMatch(
      /\.field__toggle-control\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*gap:\s*12px;[\s\S]*\}/
    );
  });

  it("should give the manager sidebar its own scroll area inside the workbench", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

    expect(css).toMatch(
      /\.manager-sidebar\s*\{[\s\S]*height:\s*100%;[\s\S]*overflow-y:\s*auto;[\s\S]*scrollbar-gutter:\s*stable;[\s\S]*\}/
    );
  });

  it("should render manager sidebar children as compact data rows", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

    expect(css).toMatch(
      /\.manager-tree__children\s*\{[\s\S]*gap:\s*2px;[\s\S]*padding:\s*2px 0 0 10px;[\s\S]*\}/
    );
    expect(css).toMatch(
      /\.manager-tree__node\s*\{[\s\S]*min-height:\s*32px;[\s\S]*border-radius:\s*8px;[\s\S]*background:\s*transparent;[\s\S]*\}/
    );
  });
});
