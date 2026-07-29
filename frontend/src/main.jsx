import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";
import App from "./App.jsx";
import { store } from "./store/index.js";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <Provider store={store}>
        <BrowserRouter>
          <App />
          <Toaster theme="dark" position="top-right" richColors />
        </BrowserRouter>
      </Provider>
    </HelmetProvider>
  </React.StrictMode>,
);