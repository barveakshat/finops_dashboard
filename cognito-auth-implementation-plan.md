# Cognito Auth — Implementation Plan
### FinOps Dashboard — Option 3 (Cognito User Pool + Native JWT Authorizer)

> **Sequencing:** Build this AFTER GitHub Actions CI/CD is working. Don't stack two infra changes at once — get the pipeline green on the existing 40 resources first, then add Cognito as its own clean PR/diff.

---

## Why This Approach (Recap)

HTTP API v2 supports JWT authorizers natively — no Lambda authorizer, no custom token-checking code. API Gateway validates the token against Cognito's issuer URL before your `api-handler` Lambda even runs. This also fixes the sign-in screen mismatch already flagged: the login screen finally gates something real, without implying multi-tenant data isolation the DynamoDB schema doesn't support. You're authenticating "is this a legit demo user," not "which org's data to filter."

---

## Task Split

| Owner | Scope |
|---|---|
| **Person A (you)** | Cognito User Pool, User Pool Client, JWT Authorizer, Terraform wiring into `api_gateway` module, seed test users, share outputs |
| **Person B** | Login UI (hosted UI redirect), token storage, `client.js` header updates, logged-out state handling in dashboard |

---

## Sequence of Tasks

### Phase 1 — Person A: Cognito Infra (Terraform)

**1.1 — New module: `terraform/modules/cognito/main.tf`**

```hcl
resource "aws_cognito_user_pool" "finops" {
  name = "finops-dashboard-${var.environment}"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  auto_verified_attributes = ["email"]
}

resource "aws_cognito_user_pool_client" "finops_client" {
  name         = "finops-dashboard-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.finops.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  generate_secret = false  # public client — React app, no secret to leak

  callback_urls = var.dashboard_callback_urls
  logout_urls   = var.dashboard_logout_urls

  allowed_oauth_flows                 = ["code"]
  allowed_oauth_scopes                = ["openid", "email"]
  allowed_oauth_flows_user_pool_client = true
  supported_identity_providers        = ["COGNITO"]
}

resource "aws_cognito_user_pool_domain" "finops_domain" {
  domain       = "finops-dashboard-${var.environment}-${var.account_id}"
  user_pool_id = aws_cognito_user_pool.finops.id
}

output "user_pool_id"     { value = aws_cognito_user_pool.finops.id }
output "user_pool_client_id" { value = aws_cognito_user_pool_client.finops_client.id }
output "user_pool_issuer" { value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.finops.id}" }
output "hosted_ui_domain" { value = "${aws_cognito_user_pool_domain.finops_domain.domain}.auth.${var.aws_region}.amazoncognito.com" }
```

`terraform/modules/cognito/variables.tf`

```hcl
variable "environment"             { type = string }
variable "account_id"              { type = string }
variable "aws_region"              { type = string }
variable "dashboard_callback_urls" { type = list(string); default = ["http://localhost:5173"] }
variable "dashboard_logout_urls"   { type = list(string); default = ["http://localhost:5173"] }
```

**Gotcha:** the domain name (`aws_cognito_user_pool_domain`) has to be globally unique across all Cognito users in that region — hence the `account_id` suffix. Don't skip it or `terraform apply` will fail with a vague "domain already exists" error that has nothing to do with your account.

---

**1.2 — Wire the JWT authorizer into `terraform/modules/api_gateway/main.tf`**

```hcl
resource "aws_apigatewayv2_authorizer" "cognito_jwt" {
  api_id           = aws_apigatewayv2_api.finops_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "finops-cognito-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = var.cognito_issuer
  }
}
```

Then on each route, add the authorizer reference:

```hcl
resource "aws_apigatewayv2_route" "get_costs" {
  api_id    = aws_apigatewayv2_api.finops_api.id
  route_key = "GET /costs"
  target    = "integrations/${aws_apigatewayv2_integration.api_handler.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}
```

Repeat for `/costs/{service}`, `/anomalies`, `/budget/{month}`.

**Gotcha:** if you add the authorizer to routes but forget `authorization_type = "JWT"` on the route itself, API Gateway silently ignores the authorizer and lets requests through unauthenticated. Both lines are required — easy to miss one.

Add `cognito_client_id` and `cognito_issuer` as new variables in `api_gateway/variables.tf`, and pass them from root `main.tf` off the Cognito module's outputs.

---

**1.3 — Seed test users (after `terraform apply`)**

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username demo@finops.dev \
  --user-attributes Name=email,Value=demo@finops.dev Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS \
  --region ap-south-1

aws cognito-idp admin-set-user-password \
  --user-pool-id <USER_POOL_ID> \
  --username demo@finops.dev \
  --password "DemoPass123!" \
  --permanent \
  --region ap-south-1
```

Do this for 1-2 users max — this is a demo, not a real user base.

---

**1.4 — Share with Person B**

After `terraform apply`, run `terraform output` and send Person B:
- `user_pool_id`
- `user_pool_client_id`
- `hosted_ui_domain`
- The demo user's email + password

---

### Phase 2 — Person B: Frontend Auth

**2.1 — Install Amplify auth helpers (or hand-roll OAuth redirect)**

```bash
cd dashboard/
npm install aws-amplify
```

**2.2 — Configure Amplify (`dashboard/src/auth/config.js`)**

```javascript
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ['openid', 'email'],
          redirectSignIn: ['http://localhost:5173'],
          redirectSignOut: ['http://localhost:5173'],
          responseType: 'code'
        }
      }
    }
  }
});
```

Add to `dashboard/.env`:
```
VITE_COGNITO_USER_POOL_ID=<from Person A>
VITE_COGNITO_CLIENT_ID=<from Person A>
VITE_COGNITO_DOMAIN=<hosted_ui_domain from Person A>
```

**2.3 — Login button + token retrieval**

```javascript
import { signInWithRedirect, fetchAuthSession } from 'aws-amplify/auth';

// Login button onClick
const handleLogin = () => signInWithRedirect();

// Get current token for API calls
async function getAuthToken() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}
```

**2.4 — Update `client.js` to attach the token**

```javascript
// dashboard/src/api/client.js
import { fetchAuthSession } from 'aws-amplify/auth';

async function authHeader() {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return { Authorization: `Bearer ${token}` };
}

export async function getCosts(period = "7d") {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/costs?period=${period}`, { headers });
  if (res.status === 401) {
    // token expired or missing — redirect to login
    throw new Error("Unauthorized — please log in");
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

Repeat the `headers` pattern for `getServiceTrend`, `getAnomalies`, `getBudget`.

**2.5 — Logged-out state**

Wrap the dashboard root in an auth check — if no valid session, show only the login button, nothing else. Don't render charts with a 401 error state; just gate the whole view.

---

### Phase 3 — Both: Integration Check

- [ ] Log in via hosted UI with demo user
- [ ] Confirm token attaches to every API call (check Network tab — `Authorization: Bearer eyJ...`)
- [ ] Confirm hitting the API without a token returns `401` (test with plain `curl` — no header)
- [ ] Confirm hitting the API with an expired/garbage token returns `401`
- [ ] Confirm dashboard renders normally once logged in

```bash
# Should fail with 401 — no token
curl -i "$API_URL/costs?period=7d"

# Should succeed
curl -i -H "Authorization: Bearer <valid-id-token>" "$API_URL/costs?period=7d"
```

---

## What NOT to Build

- No custom scopes or role-based permissions — HTTP API v2 JWT authorizer just checks "valid token or not." Don't over-engineer.
- No org filter, no `org_id` on any request — that's the multi-tenancy roadmap item, out of scope here.
- No custom signup flow — 1-2 seeded users is all the demo needs.
- No password reset flow — not needed for a demo, skip it.

---

## Interview Talking Point

*"The API Gateway route has a native JWT authorizer pointed at Cognito's issuer — no Lambda authorizer, no custom token validation code. Invalid or missing tokens get rejected before my Lambda even runs. It authenticates access, not data isolation — the DynamoDB schema doesn't have an org_id partition, so real multi-tenancy is a separate roadmap item, not something I'm claiming here."*
