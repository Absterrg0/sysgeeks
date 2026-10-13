/** Answer-first RAG definitions shared by the guide and the AI-readable content feed. */
export const RAG_FAQ = [
  {
    question: "What is the difference between RAG and an LLM?",
    answer:
      "An LLM generates text. Retrieval-augmented generation (RAG) is a system pattern that retrieves relevant information from an external source and gives it to the LLM as context before it answers. RAG adds a retrieval and data pipeline around the model; it does not replace the model or guarantee that the answer is correct.",
  },
  {
    question: "How do you design a RAG system in a system design interview?",
    answer:
      "Start with the answer contract, corpus size, freshness target, latency, and access rules. Separate document ingestion from query serving. Version and chunk source documents, attach authorization metadata, retrieve candidates using lexical and semantic search, optionally rerank them, then generate only from authorized evidence with citations or abstention. Measure retrieval quality and grounded answer quality separately.",
  },
  {
    question: "How should a RAG system enforce document permissions?",
    answer:
      "Derive the user and tenant scope from a trusted identity, apply that scope inside the retrieval service before documents enter the prompt, and recheck authorization before returning citations. Do not trust a client-supplied tenant filter or rely on the language model to hide unauthorized text.",
  },
  {
    question: "Does retrieval-augmented generation prevent hallucinations?",
    answer:
      "No. Retrieved context can be stale, irrelevant, incomplete, or wrong, and a model can still make unsupported claims. Return source-linked citations, measure whether claims are supported, and abstain when evidence is missing or conflicting.",
  },
  {
    question: "How do you keep RAG answers fresh when documents change?",
    answer:
      "Track immutable document versions and indexing state. Process updates idempotently, publish a new version only after its chunks are indexed, and make the old version unavailable after the switch. Deletions and permission revocations must invalidate retrieval and caches promptly.",
  },
  {
    question: "Can I practise this design on SysGeeks?",
    answer:
      "Start with the four follow-up drills on this page, then use a timed system design mock interview to rehearse the full answer. Focus on scope, retrieval trade-offs, access boundaries, and failure handling.",
  },
] as const;
