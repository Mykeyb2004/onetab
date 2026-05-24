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

  it("should render manager tabs as a responsive auto-fill grid", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

    expect(css).toMatch(
      /\.manager-tab-grid\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(var\(--manager-grid-min-card-width\),\s*1fr\)\);[\s\S]*\}/
    );
  });

  it("should keep card actions visually hidden until hover, focus, or explicit reveal", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

    expect(css).toMatch(
      /\.manager-tab-card\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*\}/
    );
    expect(css).toMatch(
      /\.manager-tab-card__actions\s*\{[\s\S]*margin-top:\s*auto;[\s\S]*justify-content:\s*flex-end;[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;[\s\S]*\}/
    );
    expect(css).toMatch(
      /\.manager-tab-card:is\(:hover,\s*:focus-within,\s*\[data-actions-visible="true"\]\)\s*\.manager-tab-card__actions\s*\{[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto;[\s\S]*\}/
    );
  });

  it("should give manager tab cards a stronger visual separation from the canvas", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");

    expect(css).toMatch(
      /\.manager-tab-card\s*\{[\s\S]*border:\s*1px solid rgba\(24,\s*33,\s*38,\s*0\.1\);[\s\S]*background:\s*linear-gradient\(180deg,\s*rgba\(251,\s*248,\s*242,\s*0\.98\),\s*rgba\(244,\s*239,\s*230,\s*0\.96\)\);[\s\S]*box-shadow:\s*0 1px 0 rgba\(255,\s*255,\s*255,\s*0\.45\) inset,\s*0 16px 30px rgba\(24,\s*33,\s*38,\s*0\.08\);[\s\S]*\}/
    );
  });

  it("should keep the manager header compact without an eyebrow label", () => {
    const css = readFileSync(resolve(process.cwd(), "src/ui/shared/app-shell.css"), "utf8");
    const managerApp = readFileSync(resolve(process.cwd(), "src/ui/manager/App.tsx"), "utf8");

    expect(managerApp).not.toContain('eyebrow="Manager"');
    expect(css).toMatch(
      /\.app-shell:has\(.manager-workbench\)\s*\{[\s\S]*padding-top:\s*16px;[\s\S]*gap:\s*18px;[\s\S]*\}/
    );
  });
});
