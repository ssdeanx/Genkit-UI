---
title: "Firebase Functions Deployment Technical Spike"
category: "Platform"
status: "🟡 In Progress"
priority: "High"
timebox: "1 week"
created: "2025-09-27"
updated: "2025-09-27"
owner: "Genkit-UI Team"
tags: ["technical-spike", "platform", "firebase", "functions", "deployment", "cloud"]
---

# Firebase Functions Deployment Technical Spike

## Summary

**Spike Objective:** Determine the optimal Firebase Functions deployment strategy for Genkit AI flows and agents, including authentication, secrets management, and integration with Firestore for RAG applications.

**Why This Matters:** Firebase Functions provides serverless deployment for AI workloads, but requires careful configuration for security, performance, and cost optimization. This spike will validate our deployment approach before implementing the functions component.

**Timebox:** 1 week

**Decision Deadline:** 2025-10-04 (end of timebox)

## Research Question(s)

**Primary Question:** What is the most effective way to deploy Genkit flows using Firebase Functions while ensuring security, performance, and maintainability?

**Secondary Questions:**

- How should we handle authentication and authorization for AI endpoints?
- What secrets management strategy works best for API keys and credentials?
- How can we integrate Firestore vector search for RAG applications?
- What are the performance and cost implications of different deployment configurations?
- How do we handle streaming responses and real-time AI interactions?

## Investigation Plan

### Research Tasks

- [x] Review Firebase Functions v2 capabilities and limitations
- [x] Analyze Genkit's `onCallGenkit` integration patterns
- [x] Investigate authentication options (Firebase Auth, custom claims, App Check)
- [x] Research secrets management with Cloud Secret Manager
- [x] Examine Firestore vector search integration for RAG
- [x] Configure Firebase project settings and deployment targets
- [x] Add deployment scripts and commands
- [x] Document findings and recommendations
- [ ] Create proof of concept deployment with sample flows
- [ ] Implement authentication flow with custom claims
- [ ] Set up Cloud Secret Manager secrets
- [ ] Configure Firestore database and vector indexes
- [ ] Test streaming performance and cold start times

### Success Criteria

**This spike is complete when:**

- [x] Clear deployment architecture documented
- [x] Authentication and security strategy defined
- [x] Secrets management approach validated
- [x] Firestore integration pattern established
- [x] Firebase project configuration completed
- [x] Deployment scripts and commands added
- [ ] Performance benchmarks completed
- [ ] Production deployment tested
- [ ] Cost optimization recommendations provided

## Technical Context

**Related Components:** functions/, src/agents/, src/flows/, src/tools/

**Dependencies:** Firebase project setup, Genkit AI integration, Firestore database

**Constraints:**

- Must support streaming responses for real-time AI
- Need secure API key management
- Should integrate with existing agent architecture
- Must handle authentication and authorization
- Should support RAG with vector search## Research Findings

### Investigation Results

**Firebase Functions v2 Capabilities:**

- Native Genkit integration via `onCallGenkit` method
- Automatic support for streaming and JSON responses
- Built-in authentication with Firebase Auth
- App Check enforcement for additional security
- CORS policy configuration
- Secret management through Cloud Secret Manager

**Authentication Patterns:**

- `hasClaim('email_verified')` for basic email verification
- Custom claims for role-based access control
- App Check with optional token consumption
- Firebase Auth integration with automatic user context

**Secrets Management:**

- `defineSecret()` for Cloud Secret Manager integration
- Automatic injection into function environment
- Support for multiple secrets per function
- Secure storage separate from code

**Firestore Integration:**

- `defineFirestoreRetriever()` for vector search
- Support for COSINE, EUCLIDEAN, and DOT_PRODUCT distance measures
- Automatic embedding generation and storage
- Query filtering with `where` clauses
- Collection override capabilities

### Prototype/Testing Notes

**Deployment Configuration Testing:**

```typescript
// Basic deployment pattern
export const myFlow = onCallGenkit({
  secrets: [apiKey],
  authPolicy: hasClaim('premium_user'),
  enforceAppCheck: true,
}, myFlow);

// Streaming flow support
const streamingFlow = ai.defineFlow({
  name: 'streamingFlow',
  inputSchema: z.string(),
  outputSchema: z.string(),
  streamSchema: z.string(),
}, async (input, { sendChunk }) => {
  // Automatic streaming support
});
```

**Firestore RAG Integration:**

```typescript
const retriever = defineFirestoreRetriever(ai, {
  name: 'exampleRetriever',
  firestore,
  collection: 'documents',
  contentField: 'text',
  vectorField: 'embedding',
  embedder: embedderInstance,
  distanceMeasure: 'COSINE',
});

// Retrieval with filtering
const docs = await ai.retrieve({
  retriever,
  query: 'search query',
  options: {
    limit: 5,
    where: { category: 'example' },
  },
});
```

### External Resources

- [Firebase Functions Genkit Integration](https://firebase.google.com/docs/genkit) - Official Firebase docs
- [Cloud Firestore Vector Search](https://firebase.google.com/docs/firestore/vector-search) - Vector search capabilities
- [Genkit Firebase Plugin](https://genkit.dev/docs/plugins/firebase) - Plugin documentation
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started) - Security best practices

## Decision

### Recommendation

#### Adopt Firebase Functions v2 with Genkit Integration

#### Primary Deployment Pattern

- Use `onCallGenkit()` for all flow deployments
- Implement role-based authentication with custom claims
- Enable App Check for production deployments
- Use Cloud Secret Manager for all API credentials

#### Firestore Integration Strategy

- Implement vector search for RAG applications
- Use COSINE distance measure as default
- Structure documents with content, embedding, and metadata fields
- Create composite indexes for efficient querying

#### Security Architecture

- Firebase Auth for user authentication
- Custom claims for authorization levels
- App Check enforcement on all production endpoints
- Secret Manager for credential storage

### Rationale

Firebase Functions provides the best balance of:

- **Native Genkit Support:** Seamless integration with `onCallGenkit`
- **Security:** Built-in authentication and secret management
- **Scalability:** Automatic scaling with pay-per-execution model
- **Ecosystem Integration:** Direct Firestore access for RAG
- **Developer Experience:** Same development workflow as local flows

### Implementation Notes

**Required Firebase Project Setup:**

1. Upgrade to Blaze plan for Functions deployment
2. Enable Firestore database
3. Configure authentication providers
4. Set up App Check (recommended for production)

**Environment Configuration:**

```bash
# Required secrets
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set OTHER_API_KEYS

# Project configuration
firebase use your-project-id
```

**Flow Deployment Pattern:**

```typescript
// Standard deployment template
export const deployedFlow = onCallGenkit({
  secrets: [apiKey],
  authPolicy: hasClaim('email_verified'),
  enforceAppCheck: true,
}, flow);
```

## Wiring Implementation

### Phase 1: Core Function Setup

**Functions Configuration (`functions/src/index.ts`):**

```typescript
import { onCallGenkit, hasClaim } from 'firebase-functions/https';
import { defineSecret } from 'firebase-functions/params';
import { ai } from './config.js';

// Define secrets
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Import existing flows from src/flows
import { menuSuggestionFlow } from '../../src/flows/recipeGeneratorFlow.js';

// Deploy flows with authentication
export const menuSuggestion = onCallGenkit({
  secrets: [geminiApiKey],
  authPolicy: hasClaim('email_verified'),
  enforceAppCheck: true,
}, menuSuggestionFlow);
```

**Required Secrets Setup:**

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set SERPAPI_API_KEY
firebase functions:secrets:set NEWSAPI_API_KEY
```

### Phase 2: Authentication & Security

**Firebase Auth Setup:**

- Enable Google authentication in Firebase Console
- Configure custom claims for role-based access
- Set up App Check with reCAPTCHA v3

**Security Rules (`firestore.rules`):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Vector search collections
    match /documents/{document} {
      allow read, write: if request.auth != null && 
        request.auth.token.email_verified == true;
    }
    
    // User data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Phase 3: Firestore Vector Search Setup

**Database Configuration:**

```bash
# Enable Firestore in Firebase Console
# Create composite vector index
gcloud firestore indexes composite create \
  --project=genkit-ui \
  --collection-group=documents \
  --query-scope=COLLECTION \
  --field-config=vector-config='{"dimension":"768","flat": "{}"}',field-path=embedding
```

**Retriever Implementation (`functions/src/retrievers.ts`):**

```typescript
import { defineFirestoreRetriever } from '@genkit-ai/firebase';

export const documentRetriever = defineFirestoreRetriever(ai, {
  name: 'documentRetriever',
  firestore: getFirestore(),
  collection: 'documents',
  contentField: 'text',
  vectorField: 'embedding',
  embedder: googleAI.embedder('text-embedding-004'),
  distanceMeasure: 'COSINE',
});
```

### Phase 4: Agent Integration

**A2A Agent Wiring:**

```typescript
// In functions/src/agents/index.ts
import { orchestratorAgent } from '../../src/agents/orchestrator-agent/index.js';

export const orchestrator = onCallGenkit({
  secrets: [geminiApiKey],
  authPolicy: hasClaim('premium_user'),
  enforceAppCheck: true,
}, orchestratorAgent.executeFlow);
```

### Phase 5: Testing & Validation

**Local Testing:**

```bash
# Test functions locally
npm run emulators:functions

# Test with Genkit UI
npm run genkit:ui
```

**Production Validation:**

```typescript
// Client-side testing
import { httpsCallable } from 'firebase/functions';

const testFlow = httpsCallable(functions, 'menuSuggestion');
const result = await testFlow({ theme: 'Italian' });
```

### Phase 6: Monitoring & Optimization

**Performance Monitoring:**

- Enable Firebase Performance Monitoring
- Set up Cloud Logging for function execution
- Configure alerts for cold start times > 5 seconds

**Cost Optimization:**

- Set appropriate function timeouts
- Configure memory allocation based on usage
- Implement caching strategies for frequently accessed data

### Implementation Checklist

- [ ] Create `functions/src/index.ts` with flow exports
- [ ] Set up Cloud Secret Manager secrets
- [ ] Configure Firebase Auth and custom claims
- [ ] Enable App Check in Firebase Console
- [ ] Create Firestore vector indexes
- [ ] Implement retrievers for RAG functionality
- [ ] Wire up A2A agents for deployment
- [ ] Test local deployment with emulators
- [ ] Deploy to staging environment
- [ ] Performance testing and optimization
- [ ] Production deployment and monitoring setup

### Follow-up Actions

- [x] Set up Firebase project with Blaze plan
- [x] Configure Firebase project settings and deployment targets
- [x] Add deployment scripts and commands to package.json
- [ ] Configure Firestore database and vector indexes
- [ ] Implement authentication flow with custom claims
- [ ] Set up Cloud Secret Manager secrets
- [ ] Create production-ready deployed functions
- [ ] Test streaming performance and cold start times
- [ ] Document security policies and access controls
- [ ] Update architecture diagrams with Firebase integration

- [x] Set up Firebase project with Blaze plan
- [x] Configure Firebase project settings and deployment targets
- [x] Add deployment scripts and commands to package.json
- [ ] Configure Firestore database and vector indexes
- [ ] Implement authentication flow with custom claims
- [ ] Set up Cloud Secret Manager secrets
- [ ] Create production-ready deployed functions
- [ ] Test streaming performance and cold start times
- [ ] Document security policies and access controls
- [ ] Update architecture diagrams with Firebase integration

## Status History

| Date       | Status         | Notes                          |
| ---------- | -------------- | ------------------------------ |
| 2025-09-27 | 🟡 In Progress | Research initiated, docs reviewed |
| 2025-09-27 | � In Progress | Deployment strategy validated, Firebase config completed, deployment commands added, wiring implementation documented   |

---

Last updated: 2025-09-27 by Genkit-UI Team