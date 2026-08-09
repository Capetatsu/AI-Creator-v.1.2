import { useState } from "react";
import "./CreateAgentForm.css";
import { IconBolt } from "./icons.jsx";

const PLACEHOLDER =
  'e.g. "Create an agent that posts concise funny AI news every 30 minutes for technology students."';

/**
 * Prompt input for creating a new autonomous agent. Calls onCreate(prompt)
 * and lets the parent (App.jsx) own the actual API call / loading state,
 * so this component stays purely presentational.
 */
export default function CreateAgentForm({ onCreate, isSubmitting, errorMessage }) {
  const [prompt, setPrompt] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;
    onCreate(prompt.trim());
  }

  return (
    <section className="create-agent" aria-label="Create an agent">
      <div className="create-agent__icon" aria-hidden="true">
        <IconBolt width={18} height={18} />
      </div>
      <h2 className="create-agent__title">Create your agent</h2>
      <p className="create-agent__subtitle">
        Describe what you want in plain English — the planner turns it into
        a name, domain, tone, audience, and posting frequency.
      </p>

      <form className="create-agent__form" onSubmit={handleSubmit}>
        <textarea
          className="create-agent__textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={3}
          disabled={isSubmitting}
        />
        <button
          type="submit"
          className="create-agent__submit"
          disabled={isSubmitting || !prompt.trim()}
        >
          {isSubmitting ? "Creating agent…" : "Create Agent"}
        </button>
      </form>

      {errorMessage && <p className="create-agent__error">{errorMessage}</p>}
    </section>
  );
}
