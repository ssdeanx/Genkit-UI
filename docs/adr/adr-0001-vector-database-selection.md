---
title: "ADR-0001: Vector Database Selection for RAG Applications"
status: "Proposed"
date: "2025-09-27"
authors: ["GitHub Copilot", "Project Team"]
tags: ["architecture", "vector-database", "rag", "firestore"]
supersedes: ""
superseded_by: ""
---

# ADR-0001: Vector Database Selection for RAG Applications

## Status

**Proposed** | Accepted | Rejected | Superseded | Deprecated

## Context

The Genkit-UI project requires a vector database to support Retrieval-Augmented Generation (RAG) applications. The system needs to store and retrieve document embeddings efficiently for AI-powered features like document search, content generation, and knowledge retrieval.

Key requirements include:

- Scalable vector similarity search
- Integration with existing Google Cloud/Firebase infrastructure
- Support for metadata filtering
- Production-ready reliability and performance
- Cost-effective for the current Blaze plan usage

The project already uses Firebase (Firestore, Functions, App Hosting) and Google AI (Gemini models), making Google Cloud ecosystem integration a priority.

## Decision

We will use **Cloud Firestore Vector Search** as the primary vector database for RAG applications in Genkit-UI.

### Technical Details

- **Service**: Google Cloud Firestore with native vector search capabilities
- **Distance Measures**: COSINE (primary), EUCLIDEAN, DOT_PRODUCT
- **Integration**: Via `@genkit-ai/firebase` plugin
- **Indexing**: Automatic vector indexing with configurable dimensions
- **Query Support**: K-nearest neighbor search with optional metadata filtering

## Consequences

### Positive

- **POS-001**: Seamless integration with existing Firebase infrastructure and authentication
- **POS-002**: Native Google Cloud service with enterprise-grade reliability and scalability
- **POS-003**: Cost-effective within Firebase Blaze plan limits for typical RAG workloads
- **POS-004**: Automatic indexing and query optimization managed by Google Cloud
- **POS-005**: Consistent developer experience with existing Firestore data models
- **POS-006**: Built-in support for metadata filtering and complex queries

### Negative

- **NEG-001**: Limited to Google Cloud ecosystem (vendor lock-in)
- **NEG-002**: Vector search performance may be slower than specialized vector databases for very large datasets (>1M vectors)
- **NEG-003**: Additional complexity in managing Firestore security rules for vector data
- **NEG-004**: Potential cost scaling issues if vector search usage exceeds Firestore quotas

## Alternatives Considered

### Cloud SQL for PostgreSQL with pgvector

- **ALT-001**: **Description**: Managed PostgreSQL service with pgvector extension for vector similarity search
- **ALT-002**: **Rejection Reason**: While technically capable, it introduces additional infrastructure complexity and doesn't leverage existing Firebase investment

### AlloyDB for PostgreSQL

- **ALT-003**: **Description**: Google Cloud's PostgreSQL-compatible database optimized for analytical workloads with pgvector support
- **ALT-004**: **Rejection Reason**: Better suited for complex analytical queries rather than simple vector similarity search; higher cost for RAG use case

### Astra DB

- **ALT-005**: **Description**: Serverless vector database built on Apache Cassandra with Astra DB Vectorize for embedding generation
- **ALT-006**: **Rejection Reason**: Third-party service that would require separate billing and operational management outside Firebase ecosystem

### Pinecone

- **ALT-007**: **Description**: Cloud-native vector database with managed infrastructure and automatic scaling
- **ALT-008**: **Rejection Reason**: Specialized vector database that's overkill for current scale and introduces vendor complexity outside Google Cloud

### Chroma

- **ALT-009**: **Description**: Open-source vector database that can run embedded or as a server
- **ALT-010**: **Rejection Reason**: Not suitable for production multi-user applications; requires separate infrastructure management

### LanceDB

- **ALT-011**: **Description**: Open-source embedded vector database designed for AI applications
- **ALT-012**: **Rejection Reason**: File-based storage not appropriate for cloud-native, multi-instance deployments

## Implementation Notes

- **IMP-001**: Use `defineFirestoreRetriever()` with COSINE distance measure for optimal similarity matching
- **IMP-002**: Configure vector indexes using `gcloud firestore indexes composite create` command with appropriate dimensions (768 for Gemini embeddings)
- **IMP-003**: Implement proper Firestore security rules to protect vector data while allowing necessary access
- **IMP-004**: Use `FieldValue.vector()` for storing embeddings and handle embedding generation via Google AI embedders
- **IMP-005**: Monitor Firestore usage costs and query performance; consider pagination for large result sets
- **IMP-006**: Implement proper error handling for vector index creation and query failures

## References

- **REF-001**: [Cloud Firestore Vector Search Documentation](https://firebase.google.com/docs/firestore/vector-search)
- **REF-002**: [Genkit Firebase Plugin Documentation](https://firebase.google.com/docs/genkit/plugins/firebase)
- **REF-003**: [Firebase Blaze Plan Pricing](https://firebase.google.com/pricing)
- **REF-004**: [Google Cloud Firestore Quotas and Limits](https://firebase.google.com/docs/firestore/quotas)