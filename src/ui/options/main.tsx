import React from "react";
import ReactDOM from "react-dom/client";
import { OptionsApp } from "./App";
import { bootPreviewEntry } from "../../preview/preview-entry";

async function main() {
  await bootPreviewEntry(
    {
      baseUrl: window.location.href,
      globalScope: globalThis
    },
    async () => {
      ReactDOM.createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
          <OptionsApp />
        </React.StrictMode>
      );
    }
  );
}

void main();
