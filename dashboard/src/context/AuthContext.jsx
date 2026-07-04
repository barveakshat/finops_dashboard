// dashboard/src/context/AuthContext.jsx
import { createContext, useContext, useState } from "react";
import { setAccountId } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // TODO(cognito): replace body with Amplify Auth.signIn(username, password),
  // then map the returned Cognito user attributes (custom:account_id, custom:org, etc.)
  // onto the same `user` shape used below. No other file needs to change.
  function login(mockUser) {
    setAccountId(mockUser.accountId);
    setUser(mockUser);
  }

  function logout() {
    setAccountId(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}