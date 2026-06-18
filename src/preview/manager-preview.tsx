import React from "react";
import ReactDOM from "react-dom/client";
import { ManagerApp } from "../ui/manager/App";
import { bootPreviewEntry } from "./preview-entry";

async function main() {
  await bootPreviewEntry(
    {
      baseUrl: window.location.href,
      globalScope: globalThis
    },
    async () => {
      ReactDOM.createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
          <ManagerApp />
        </React.StrictMode>
      );
    }
  );
}

void main();
