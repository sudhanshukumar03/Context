import { createRoot } from "react-dom/client";
import { ApplicationErrorBoundary, ApplicationStatus } from "./components/ApplicationStartup";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(<ApplicationStatus />);
// A failed application import (including auth configuration) must leave a usable page.
void import("./App").then(({ default: App }) => {
  root.render(<ApplicationErrorBoundary><App /></ApplicationErrorBoundary>);
}).catch(() => root.render(<ApplicationStatus failed />));
