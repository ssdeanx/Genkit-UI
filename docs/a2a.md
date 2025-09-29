---
applyTo: 'src/agents/**'
tags: 'a2a', 'architecture', 'design', 'agents-cards', 'protocol', 'executor', 'client', 'express', 'sse', 'streaming'
title: 'A2A — Genkit-UI'
slug: 'a2a'
date: '2025-09-29'
author: 'sam'
summary: 'Documentation of the A2A protocol implementation in Genkit-UI using @a2a-js/sdk, covering architecture, key files, concepts, and patterns.'
---
# A2A — Genkit-UI

This project uses [@a2a-js/sdk](https://github.com/a2aproject/a2a-js) as a dependency to facilitate communication between the frontend and backend. The A2A protocol is implemented in the agents. Genkit is in beta, and the A2A protocol is also evolving, so expect some breaking changes in the future.  Knowing the A2A protocol and SDK is essential for working with the agents and their executors especially if planning to also use agents with our flows or other Genkit parts of the system.

## Key Files

- [A2A App](https://github.com/a2aproject/a2a-js)
- [A2A Express App](https://github.com/a2aproject/a2a-js/blob/main/src/server/express/a2a_express_app.ts)
- [A2A Client](https://github.com/a2aproject/a2a-js/blob/main/src/client/client.ts)
- [A2A Utils](https://github.com/a2aproject/a2a-js/blob/main/src/server/utils.ts)
- [A2A Result Manager](https://github.com/a2aproject/a2a-js/blob/main/src/server/result_manager.ts)
- [A2A Push Notification Sender](https://github.com/a2aproject/a2a-js/blob/main/src/server/push_notification/push_notification_sender.ts)
- [A2A Push Notification Store](https://github.com/a2aproject/a2a-js/blob/main/src/server/push_notification/push_notification_store.ts)
- [A2A Streaming and Async](https://a2a-protocol.org/latest/topics/streaming-and-async/)
- [A2A Types](https://github.com/a2aproject/a2a-js/blob/main/src/types.ts)
- [A2A Transport](https://github.com/a2aproject/a2a-js/blob/main/src/server/transports/jsonrpc_transport_handler.ts)
- [A2A Request Handler](https://github.com/a2aproject/a2a-js/blob/main/src/server/request_handler/a2a_request_handler.ts)
- [A2A Error](https://github.com/a2aproject/a2a-js/blob/main/src/server/error.ts)
- [A2A Store](https://github.com/a2aproject/a2a-js/blob/main/src/server/store.ts)

## Key Concepts

- [A2A JavaScript SDK](https://a2aprotocol.ai/docs/guide/a2a-javascript-sdk)
- [A2A TypeScript Guide](https://a2aprotocol.ai/docs/guide/a2a-typescript-guide)
- [A2A TypeScript Blog](https://a2aprotocol.ai/blog/a2a-typescript-guide)
- [A2A JavaScript Blog](https://a2aprotocol.ai/blog/a2a-javascript-sdk)
