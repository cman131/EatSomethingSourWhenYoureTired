import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Helmet } from "react-helmet";

import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Helmet>
        <title>CHS Riichi Mahjong</title>
      </Helmet>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);