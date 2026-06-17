import React from "react";
import ReactDOM from "react-dom/client";
import { ManagerApp } from "../ui/manager/App";
import { installPreviewChromeShim } from "./runtime-shim";

async function main() {
  const response = await fetch("/export20260524.spd");
  const spdContent = await response.text();

  if (new URLSearchParams(window.location.search).get("reset") === "1") {
    window.localStorage.clear();
  }

  await installPreviewChromeShim(spdContent);

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ManagerApp />
    </React.StrictMode>
  );
}

void main();
