// dashboard/src/context/AuthContext.jsx
import { createContext, useContext, useState } from "react";
import { setAuthToken } from "../api/client";
import { cognitoLogin } from "../api/cognito";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function login(email, password) {
    setLoading(true);
    setAuthError(null);

    try {
      const tokens = await cognitoLogin(email, password);

      // Set the ID token on the API client — this is what the JWT authorizer validates.
      // Must be the ID token (has aud = client_id), NOT the access token.
      setAuthToken(tokens.idToken);

      // Parse minimal user info from the ID token payload (base64 JWT middle segment)
      const payload = JSON.parse(atob(tokens.idToken.split(".")[1]));

      setUser({
        email: payload.email || email,
        name: payload.email || email,
        initials: (payload.email || email).slice(0, 2).toUpperCase(),
      });
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
    setAuthError(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, authError, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}