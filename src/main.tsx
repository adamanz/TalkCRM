import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { AuthKitProvider } from "@workos-inc/authkit-react";
import "./index.css";
import App from "./App.tsx";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthKitProvider
      clientId={import.meta.env.VITE_WORKOS_CLIENT_ID}
      redirectUri={import.meta.env.VITE_WORKOS_REDIRECT_URI || `${window.location.origin}/callback`}
      devMode={true}
    >
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </AuthKitProvider>
  </StrictMode>,
);
