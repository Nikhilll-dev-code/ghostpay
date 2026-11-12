import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { SafetyProvider } from "./context/SafetyContext";
import { ToastProvider } from "./components/Toast";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <SafetyProvider>
          <App />
        </SafetyProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
