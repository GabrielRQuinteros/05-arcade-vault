import { jwtClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Sin baseURL: mismo origen (/api/auth/*).
export const authClient = createAuthClient({
  plugins: [usernameClient(), jwtClient()],
});
