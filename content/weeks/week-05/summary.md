---
week: 5
title: Knowledge-Augmented AI Systems - Part 1
status: lecture_and_schedule
scope: Context beyond model parameters, RAG, Memory, Tool, and Vector Embedding.
source: dasd2026/src/components/Schedule.jsx, dasd2026/src/components/lectures/Week5.jsx
---

# Week 05 · Knowledge-Augmented AI Systems - Part 1

The title follows the current Week5.jsx lecture and the instructor’s update. This summary uses that local lecture text, including its pipeline figure descriptions; it does not claim to summarize the linked Google Slides.

## Learning objectives

- Distinguish knowledge in model parameters from information supplied through context, memory and tools.
- Explain a RAG pipeline and identify where retrieval and generation can fail independently.
- Explain vector embeddings and similarity search without confusing similarity with truth.
- Design what a service should remember, retrieve, update and forget.
- Choose between document retrieval, user memory and a tool call for a concrete user need.

## Context beyond training

Training learns patterns in model parameters. It does not automatically provide the latest course handbook, a particular learner's earlier difficulty or today's equipment availability. Supplying context changes the current input, not the trained weights.

Select information according to: User goal → Information needed → Appropriate source → Selected context → Response.

The lecture gives seven complementary approaches:

- **Long prompt / direct context:** Include material directly, such as a complete short set of lecture notes.
- **RAG:** Retrieve relevant passages, such as the paragraph explaining cosine similarity.
- **Structured knowledge / OKF:** Organize linked documents that an agent can navigate, such as concepts and prerequisites. This organizes knowledge and can be combined with direct reading or RAG.
- **Memory:** Recall selected saved information, such as previous mistakes or an explanation preference. It must be brought into the current context to be useful.
- **Tool / API:** Query an external system, such as the latest assignment deadline or live inventory.
- **Current task state:** Include the current problem, draft solution or selected passage.
- **Ask the user:** Clarify missing context, such as whether a formula or its application is difficult.

A small stable document may fit directly in context; RAG selects from larger or changing collections; structured APIs are appropriate for exact live state. These methods can overlap: memory can use retrieval and a retriever can be a tool. Fine-tuning changes parameters and does not replace keeping external facts current.

## RAG: preparation and question-time pipelines

RAG retrieves external information and supplies it as context for generation. Updating an external index can change accessible information without retraining the generator.

Document preparation:

1. Prepare source documents, retaining source IDs, dates/versions and access metadata.
2. Split documents into meaningful passages. Small chunks may lose context; large chunks may dilute relevance. Preserve headings and source links.
3. Embed chunks and store vectors with their linked source passages in a search index.

At question time:

1. Embed the query using an encoder compatible with the document embedding space.
2. Retrieve candidate passages. Filter by permissions and version; combine keyword and semantic search or rerank when useful.
3. Assemble selected evidence within the model's input budget. More passages are not always better.
4. Generate an answer supported by that evidence, with source IDs. Make conflicts visible and acknowledge insufficient evidence.

Retrieval may miss the right passage or return an outdated one. Generation may ignore evidence, combine incompatible claims or attach a citation that does not support its sentence. Retrieval and generation must be checked separately; RAG does not guarantee correctness.

## Vector Embedding: finding related meaning

An embedding model maps text into a vector, an ordered list of numbers. Semantic retrieval models can place related texts near one another even with different words, such as “borrow a camera” and “equipment reservation.” Query and document encoders must be compatible in the same embedding space. The retriever finds passages; the generator uses their selected text to answer.

Cosine similarity compares vector directions: cosine(q, d) = (q · d) / (‖q‖ × ‖d‖). For nonzero vectors it ranges from −1 to 1. A score of 0.9 is not a 90% probability that a passage is true or useful.

Semantic similarity is not factual agreement: “open on Sunday” and “closed on Sunday” can be close in topic. Top-k still selects neighbors when enough candidates exist even if none answers the question. Product codes, dates, names and negation may require keyword search, metadata or reranking. Embedding model, language, chunk boundaries and distance metric affect retrieval; a two-dimensional projection simplifies a higher-dimensional space.

## Memory and tools

Conversation history in the current input differs from persistent memory across sessions. Memory requires selecting, storing with provenance, retrieving, updating and forgetting information. The lecture distinguishes working context, episodic events and stable profile facts. Storing every utterance does not automatically create useful continuity. For live external state, select the appropriate tool result rather than assuming an old document or remembered value is current.
