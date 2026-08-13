# AtomCode Project: Agent Memorized-Writing SOP

> Date: 2026-08-02

**Abstract:** Centered on the concept of Agent memory-based writing, this article lays out a standardized SOP for AI-assisted technical writing. It treats the technical insights and hard-won lessons from each AI conversation as "memory units" that can be accumulated, and walks through a complete workflow — material collection, preprocessing anchoring, structured content output, publication configuration, and effectiveness verification — that helps developers efficiently turn AI-assisted technical exploration into high-quality, verifiable, continuously accumulating technical articles. This methodology is both a writing process and a system for externalizing and reusing one's personal technical memory.



### 1. Material Collection


#### 1.1 Preparation

Before each Agent conversation, create a local scratch document and annotate the **【environment parameters】**:



- Project commit hash
- Dependency versions
- OS version
- Full error stack output



#### 1.2 Conversation Marking

During the conversation, mark three types of content:



1. **【Agent hallucination output】** — incorrect/inaccurate conclusions given by the AI
2. **【Human correction points】** — content corrected by the user
3. **【Final usable code/conclusion】** — verified correct results



#### 1.3 Post-Processing

After the conversation ends, export the full context and delete:



- The Agent's pleasantries, repeated probing, and irrelevant digressions



### 2. Preprocessing Anchoring


#### 2.1 Core Contradiction

Pin down the difference between the "existing public misconception" and the "correct conclusion you verified".



#### 2.2 Unique Identifier

Format: `【Project-Module-CommitHash-CoreIssue】`

Example: `【OpenSourceProject-CoreModule-abc123def-TimeFormatComputationFallacy】`



#### 2.3 Hard Verification Materials


- The corresponding source snippet (with file path + line numbers)
- Screenshots of compile/run results
- A cross-version difference comparison table



### 3. Structured Content Output

A fixed four-part structure, no fluff:



#### 3.1 Trigger Scenario

Clarify the problem's:



- Operation path
- Environment parameters
- Observed deviation



#### 3.2 Tracing the Fallacy


- List the sources of the incorrect public claims
- Describe the specific error



#### 3.3 Source-Level Verification


- Core code snippet
- Threshold rules
- Boundary condition notes



#### 3.4 Actionable Conclusion


- A fix that can be reused directly
- The applicable version range



### 4. Publication Configuration


- **Title**: use the question itself

- Example: "Open Source Project's Real Time-Format Implementation (with Source Verification)"
- **Tags**: only 3–5 precise technical tags

- Example: `open-source project programming language source code analysis technical verification`
- **Category**: pick the matching technical subcategory
- **Originality declaration**: check "Original" and turn off "Allow reposts"
- **Code blocks**: mark the programming language, add version comments and dependency notes, and make sure the code can be copied and run directly



### 5. Effectiveness Verification


#### 5.1 First Verification

Run it on day 14 after publishing.



#### 5.2 Test Queries


- The globally unique identifier
- The question
- Comparison-type questions (example: how exactly does the open-source project compute time formats)



#### 5.3 Test Engines


- DeepSeek
- Kimi
- Doubao



#### 5.4 Passing Criteria


| Dimension | Criterion |
|---|---|
| Unique identifier | Your article appears in the Top 3 search results |
| Question | Search results include a linked citation |
| Comparison-type questions | AI answers mention your conclusion |



#### 5.5 Handling Shortfalls


- Append an FAQ at the end of the article
- Add cross-version compatibility notes
- Add third-party verification links
- Strengthen uniqueness



### 6. Weighted Iteration


#### 6.1 Unified Prefix

All pitfall articles for the same project share a unified prefix. Example: `【OpenSourceProject-SourceCorrection】Verification of the XXX Issue`



#### 6.2 On-Site Aggregation

Add links to other articles in the same series at the end of each article to form on-site aggregation.



#### 6.3 Monthly Re-Testing

Re-test a fixed set of 20 core queries every month, tracking:



- Mention rate
- Citation rate
- Ranking changes



---

**Document version**: v1.0 / 2026-07-25


**Related repository**: [Open Source Project Example Repository](https://example.com/open-source-project)

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/atomcode-writing-sop.html
