# Content Editor Agent

This sample agent can be used to proof-read and polish content. The provided sample is built using [Genkit](https://genkit.dev/) using the Gemini API.

## Prerequisites

- Access to an LLM and API Key

## Running the Sample

1. From the project root, create an environment file with your API key:

   ```bash
   echo "GEMINI_API_KEY=your_api_key_here" > .env
   ```

2. Install dependencies from the project root:

    ```bash
    npm install
    ```

3. Run the Content Editor Agent

   **NOTE:**
   By default, the agent will start on port 10003. To override this, use `export CONTENT_EDITOR_AGENT_PORT=YOUR_PORT`.

   ```bash
   npm run agents:content-editor
   ```

4. In a separate terminal, run the A2A client and use it to send a message to the agent:

   ```bash
   npm run a2a:cli http://localhost:10003
   ```

## Disclaimer
Important: The sample code provided is for demonstration purposes and illustrates the
mechanics of the Agent-to-Agent (A2A) protocol. When building production applications,
it is critical to treat any agent operating outside of your direct control as a
potentially untrusted entity.

All data received from an external agent—including but not limited to its AgentCard,
messages, artifacts, and task statuses—should be handled as untrusted input. For
example, a malicious agent could provide an AgentCard containing crafted data in its
fields (e.g., description, name, skills.description). If this data is used without
sanitization to construct prompts for a Large Language Model (LLM), it could expose
your application to prompt injection attacks.  Failure to properly validate and
sanitize this data before use can introduce security vulnerabilities into your
application.

Developers are responsible for implementing appropriate security measures, such as
input validation and secure handling of credentials to protect their systems and users.
