// dashboard/src/api/cognito.js
// Direct Cognito USER_PASSWORD_AUTH — no Amplify dependency needed.
// Uses the public InitiateAuth API (no client secret required).

const COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION || "ap-south-1";
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;

const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

/**
 * Authenticate a user with email + password via USER_PASSWORD_AUTH.
 * Returns { idToken, accessToken, refreshToken } on success.
 * Throws an Error with Cognito's message on failure.
 */
export async function cognitoLogin(username, password) {
  const res = await fetch(COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.__type || "Authentication failed");
  }

  const result = data.AuthenticationResult;
  return {
    idToken: result.IdToken,
    accessToken: result.AccessToken,
    refreshToken: result.RefreshToken,
  };
}
