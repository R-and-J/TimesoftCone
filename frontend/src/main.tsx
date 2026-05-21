import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CurrentUserProvider } from "./lib/current-user";
import { ToastProvider } from "./lib/toast";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CurrentUserProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </CurrentUserProvider>
  </React.StrictMode>,
);
