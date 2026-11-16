import { reportError } from "@/lib/report";

window.addEventListener("error", (event) => reportError(event.error ?? event.message, { source: "window.onerror" }));
window.addEventListener("unhandledrejection", (event) => reportError(event.reason, { source: "unhandledrejection" }));
