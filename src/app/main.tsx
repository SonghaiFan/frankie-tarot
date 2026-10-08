import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "@/app/App";
import { I18nProvider } from "@/i18n/I18nProvider";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nProvider><App /></I18nProvider>
  </React.StrictMode>
);
