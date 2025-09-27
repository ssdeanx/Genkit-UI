---
title: Functions Component - Technical Documentation
component_path: functions
version: 1.0
date_created: 2025-09-27
last_updated: 2025-09-27
owner: Genkit-UI Team
tags:
  - component
  - firebase
  - functions
  - serverless
  - deployment
  - genkit
  - ai
  - cloud
  - typescript
---

# Functions Component Documentation

The Functions Component provides serverless deployment infrastructure for Genkit AI flows and agents using Google Cloud Firebase Functions. It enables scalable, secure, and observable deployment of AI-powered functionality with built-in authentication, telemetry, and secret management.

## 1. Component Overview

### Purpose/Responsibility

- OVR-001: Provide serverless deployment platform for Genkit flows and agents
- OVR-002: Enable secure API key management through Firebase Secrets Manager
- OVR-003: Implement Firebase telemetry and observability for AI operations
- OVR-004: Support streaming responses and real-time AI interactions
- OVR-005: Handle authentication and authorization for AI endpoints

## 2. Architecture Section

The Functions Component follows a serverless architecture pattern using Firebase Functions v2, with specialized configuration for Genkit AI workloads. It implements the deployment layer of the Genkit-UI system, providing cloud-hosted endpoints for AI flows and agents.

- ARC-001: Design patterns: Serverless (Function-as-a-Service), Dependency Injection (Genkit plugins), Factory (flow creation), Observer (telemetry)
- ARC-002: Internal dependencies: Genkit ai instance, Firebase Functions v2, Express.js for HTTP handling
- ARC-003: External dependencies: Google AI API (Gemini), Firebase Admin SDK, Cloud Secret Manager, Google Cloud Observability
- ARC-004: Component interactions: Receives flow/agent definitions from main application, exposes HTTP endpoints, integrates with Firebase Auth and App Check
- ARC-005: Deployment model: Serverless functions with automatic scaling, pay-per-execution pricing, regional deployment
- ARC-006: Visual diagrams below

### Component Structure and Dependencies Diagram

```mermaid
graph TD
    subgraph "Functions Component"
        MAIN[index.ts] --> CONFIG[config.ts]
        MAIN --> SAMPLE[genkit-sample.ts]
        CONFIG --> AI[Genkit AI Instance]
        SAMPLE --> FLOW[Menu Suggestion Flow]
    end

    subgraph "Firebase Infrastructure"
        FUNCTIONS[Firebase Functions v2] --> SECRETS[Secret Manager]
        FUNCTIONS --> AUTH[Firebase Auth]
        FUNCTIONS --> TELEMETRY[Cloud Observability]
        FUNCTIONS --> APPCHECK[App Check]
    end

    subgraph "External Services"
        GEMINI[Google Gemini API]
        FIREBASE[FIREBASE_PROJECT]
        CLOUD[Google Cloud Platform]
    end

    subgraph "Build & Dev Tools"
        TSC[TypeScript Compiler]
        ESLINT[ESLint]
        TSX[tsx Runner]
    end

    AI --> GEMINI
    FLOW --> FUNCTIONS
    FUNCTIONS --> SECRETS
    FUNCTIONS --> AUTH
    FUNCTIONS --> TELEMETRY
    FUNCTIONS --> APPCHECK
    CONFIG --> FIREBASE
    TSC --> LIB[lib/ Output]
    TSX --> DEV[Development Server]

    classDiagram
        class FirebaseFunction {
            +onCallGenkit(flow, options): CallableFunction
            +hasClaim(claim): AuthPolicy
            +defineSecret(name): SecretParam
        }

        class GenkitConfig {
            +plugins: Plugin[]
            +enableFirebaseTelemetry(): void
            +defineFlow(name, handler): Flow
        }

        class MenuSuggestionFlow {
            +name: string
            +inputSchema: ZodSchema
            +outputSchema: ZodSchema
            +streamSchema: ZodSchema
            +handler(subject, streaming): Promise~string~
        }

        class TelemetryPlugin {
            +enableFirebaseTelemetry(): void
            +metrics: Observable
            +traces: Observable
            +logs: Observable
        }

        FirebaseFunction --> GenkitConfig
        GenkitConfig --> MenuSuggestionFlow
        GenkitConfig --> TelemetryPlugin
```

## 3. Interface Documentation

### Function Categories and Interfaces

| Category | Purpose | Functions | Key Features |
|----------|---------|-----------|--------------|
| **AI Flows** | Deployable AI workflows | menuSuggestionFlow | Streaming responses, Zod validation, telemetry |
| **Authentication** | Security and access control | hasClaim, authPolicy | Firebase Auth integration, custom claims |
| **Secrets Management** | API key security | defineSecret | Cloud Secret Manager integration |
| **Telemetry** | Observability and monitoring | enableFirebaseTelemetry | Cloud Logging, Cloud Trace, Cloud Monitoring |

### Function Reference Table

| Function/Method | Purpose | Parameters | Return Type | Usage Notes |
|-----------------|---------|------------|-------------|-------------|
| `onCallGenkit(options, flow)` | Create callable Genkit function | `{secrets?, authPolicy?, enforceAppCheck?}, flow` | `HttpsFunction` | Auto-handles streaming, authentication |
| `hasClaim(claim)` | Create auth policy for claims | `claim: string` | `AuthPolicy` | Used in authPolicy option |
| `defineSecret(name)` | Define secret parameter | `name: string` | `SecretParam` | References Cloud Secret Manager |
| `enableFirebaseTelemetry()` | Enable Firebase observability | None | `void` | Must be called before genkit init |
| `menuSuggestionFlow` | Generate menu suggestions | `subject: string` | `Promise<string>` | Sample streaming flow |

## 4. Implementation Details

- IMP-001: Uses Firebase Functions v2 with Genkit native integration via `onCallGenkit`
- IMP-002: Implements streaming flows with automatic chunk handling and response streaming
- IMP-003: Configures Genkit with Google AI plugin and Firebase telemetry
- IMP-004: Manages secrets through Firebase Secret Manager for API key security
- IMP-005: Supports authentication policies with Firebase Auth claims
- IMP-006: Includes TypeScript strict compilation with NodeNext modules
- IMP-007: Uses ESLint with Google style guide and TypeScript rules

### Function Implementation Patterns

#### Genkit Flow Deployment Pattern

```typescript
import { onCallGenkit, hasClaim } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";

const apiKey = defineSecret("GOOGLE_GENAI_API_KEY");

const myFlow = ai.defineFlow({
  name: 'myFlow',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.string(),
}, async (input) => {
  const response = await ai.generate({
    prompt: `Process: ${input}`,
  });
  return response.text;
});

export const myDeployedFlow = onCallGenkit({
  secrets: [apiKey],
  authPolicy: hasClaim("email_verified"),
  enforceAppCheck: true,
}, myFlow);
```

#### Streaming Flow Pattern

```typescript
const streamingFlow = ai.defineFlow({
  name: 'streamingFlow',
  inputSchema: z.string().describe("Input prompt"),
  outputSchema: z.string(),
  streamSchema: z.string(),
}, async (input, { sendChunk }) => {
  const { response, stream } = ai.generateStream({
    prompt: input,
  });

  for await (const chunk of stream) {
    sendChunk(chunk.text);
  }

  return (await response).text;
});
```

#### Configuration Pattern

```typescript
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

enableFirebaseTelemetry();

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY,
    }),
  ],
});
```

## 5. Usage Examples

### Basic Flow Deployment

```typescript
// In genkit-sample.ts or similar
import { onCallGenkit } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";

const apiKey = defineSecret("GOOGLE_GENAI_API_KEY");

const simpleFlow = ai.defineFlow({
  name: 'simpleFlow',
  inputSchema: z.string(),
  outputSchema: z.string(),
}, async (input) => {
  const response = await ai.generate({
    prompt: input,
  });
  return response.text;
});

export const deployedFlow = onCallGenkit({
  secrets: [apiKey],
}, simpleFlow);
```

### Advanced Deployment with Auth

```typescript
export const secureFlow = onCallGenkit({
  secrets: [apiKey],
  authPolicy: hasClaim("premium_user"),
  enforceAppCheck: true,
}, premiumFlow);
```

### Local Development

```bash
# Start local development server
npm run genkit:start

# Build for production
npm run build

# Test locally with Firebase emulators
npm run serve

# Deploy to production
firebase deploy --only functions
```

### Client-Side Usage

```typescript
// Call from web app
import { httpsCallable } from 'firebase/functions';

const callFlow = httpsCallable(functions, 'menuSuggestion');
const result = await callFlow({ theme: 'Italian' });
console.log(result.data); // Flow response
```

## 6. Quality Attributes

- QUA-001: Security: Firebase Auth integration, App Check enforcement, secret key management, input validation
- QUA-002: Performance: Serverless auto-scaling, streaming responses, efficient cold starts, regional deployment
- QUA-003: Reliability: Firebase Functions redundancy, error handling, timeout management, retry logic
- QUA-004: Maintainability: TypeScript strict mode, ESLint enforcement, clear separation of concerns, comprehensive logging
- QUA-005: Extensibility: Plugin architecture for Genkit, modular flow definitions, environment-based configuration

## 7. Reference Information

- REF-001: Dependencies: Firebase Functions ^6.4.0, Genkit ^1.19.3, @genkit-ai/firebase ^1.19.3, @genkit-ai/googleai ^1.19.3, TypeScript ^5.9.2
- REF-002: Configuration: Firebase project setup required, GOOGLE_GENAI_API_KEY secret, Node.js 22 runtime
- REF-003: Testing: Firebase emulators for local testing, firebase-functions-test for unit tests, integration tests with deployed functions
- REF-004: Troubleshooting:
  - Cold start issues: Optimize imports, use connection pooling
  - Timeout errors: Increase function timeout, optimize flow logic
  - Auth failures: Verify Firebase Auth setup, check custom claims
  - Secret access: Ensure secrets are deployed with `firebase functions:secrets:set`
  - Build errors: Check TypeScript configuration, verify dependencies
- REF-005: Related docs: Firebase Functions documentation, Genkit deployment guide, Google Cloud Secret Manager
- REF-006: Change history: Initial Firebase Functions setup with Genkit integration; added streaming support; implemented authentication and secrets management; added telemetry and observability