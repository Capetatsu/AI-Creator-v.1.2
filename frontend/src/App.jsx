import { useEffect, useState, useCallback } from "react";
import { fetchAgentFeed } from "./api/fetchFeed.js";
import { fetchAgentInfo } from "./api/fetchAgentInfo.js";
import { createAgent, runNow, pauseAgent, resumeAgent, getStatus } from "./api/controlApi.js";
import { AGENT_ID_STORAGE_KEY } from "./constants.js";
import AgentStatus from "./components/AgentStatus.jsx";
import CreateAgentForm from "./components/CreateAgentForm.jsx";
import AgentControls from "./components/AgentControls.jsx";
import PostFeed from "./components/PostFeed.jsx";
import LoadingState from "./components/LoadingState.jsx";
import EmptyState from "./components/EmptyState.jsx";
import ErrorState from "./components/ErrorState.jsx";
import { IconBolt } from "./components/icons.jsx";

// "loading" | "success" | "error"
export default function App() {
  const [agentId, setAgentId] = useState(() => localStorage.getItem(AGENT_ID_STORAGE_KEY));
  const [agentInfo, setAgentInfo] = useState(null); // { name, domain, tone, ... } from the backend

  const [status, setStatus] = useState("loading");
  const [posts, setPosts] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  // Control-server state: pause/resume + activity log for the demo controls.
  const [paused, setPaused] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunningNow, setIsRunningNow] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadFeed = useCallback((id) => {
    setStatus("loading");
    setErrorMessage("");

    fetchAgentFeed(id)
      .then((data) => {
        setPosts(data.posts || []);
        setStatus("success");
      })
      .catch((error) => {
        setErrorMessage(error.message || "Something went wrong.");
        setStatus("error");
      });
  }, []);

  const loadAgentInfo = useCallback((id) => {
    fetchAgentInfo(id)
      .then((data) => setAgentInfo(data.agent))
      .catch(() => {
        // Non-fatal — the dashboard still works without this, it just
        // won't show name/domain/tone. The feed is the important part.
      });
  }, []);

  const loadControlStatus = useCallback(() => {
    getStatus()
      .then((data) => {
        setPaused(Boolean(data.paused));
        setActivityLog(data.activityLog || []);
      })
      .catch(() => {
        // The control server is optional for viewing an existing feed —
        // e.g. it might not be running if you only started the CLI
        // agent.js instead. Fail silently and just hide the controls.
      });
  }, []);


  useEffect(() => {
    if (!agentId) return;

    loadFeed(agentId);

    const interval = setInterval(() => {
      loadFeed(agentId);
    }, 5000);
    loadAgentInfo(agentId);
    loadControlStatus();
    return () => clearInterval(interval);
  }, [agentId, loadFeed, loadAgentInfo, loadControlStatus]);

  function handleCreateAgent(prompt) {
    setIsCreating(true);
    setCreateError("");

    createAgent(prompt)
      .then((data) => {
        localStorage.setItem(AGENT_ID_STORAGE_KEY, data.agentId);
        setAgentId(data.agentId);
      })
      .catch((error) => {
        setCreateError(error.message || "Failed to create agent.");
      })
      .finally(() => setIsCreating(false));
  }

  function handleRunNow() {
    setIsRunningNow(true);
    runNow()
      .then(() => {
        loadFeed(agentId);
        loadControlStatus();
      })
      .catch((error) => setErrorMessage(error.message))
      .finally(() => setIsRunningNow(false));
  }

  function handlePause() {
    pauseAgent().then(() => setPaused(true));
  }

  function handleResume() {
    resumeAgent().then(() => setPaused(false));
  }

  // "New Agent": stops the *frontend* from displaying the current agent
  // and sends the user back to the Create Agent screen. It intentionally
  // does NOT touch the backend: the active agent's server-side loop keeps
  // running, its SQLite rows (agent + posts) are untouched, and no other
  // persisted agent is affected. It only clears the localStorage pointer
  // this browser tab uses to know which agent to display, plus this
  // component's own display state.
  function handleNewAgent() {
    localStorage.removeItem(AGENT_ID_STORAGE_KEY);
    setAgentId(null);
    setAgentInfo(null);
    setPosts([]);
    setStatus("loading");
    setErrorMessage("");
    setPaused(false);
    setActivityLog([]);
    setCreateError("");
  }

  return (
    <div className="page">
      <nav className="topnav">
        <div className="topnav__brand">
          <span className="topnav__logo">
            <IconBolt width={16} height={16} />
          </span>
          Autonomous AI Creator
        </div>
        <span className="topnav__badge">Hackathon Demo</span>
      </nav>

      <header className="hero">
        <span className="hero__eyebrow">AI Content Agent</span>
        <h1>Your agent's content, live</h1>
        <p className="hero__subtitle">
          Track what your autonomous AI agent is publishing, and see exactly
          why it chose each post.
        </p>
      </header>

      {!agentId ? (
        <CreateAgentForm
          onCreate={handleCreateAgent}
          isSubmitting={isCreating}
          errorMessage={createError}
        />
      ) : (
        <>
          <AgentStatus
            name={agentInfo?.name || "Your agent"}
            domain={agentInfo?.domain || "—"}
            autonomous={!paused}
            postCount={posts.length}
          />

          <AgentControls
            paused={paused}
            activityLog={activityLog}
            onRunNow={handleRunNow}
            onPause={handlePause}
            onResume={handleResume}
            onNewAgent={handleNewAgent}
            isRunning={isRunningNow}
          />

          <main className="page__main">
            <div className="section-heading">
              <h2>Recent posts</h2>
              {status === "success" && posts.length > 0 && (
                <span className="section-heading__hint">Newest first</span>
              )}
            </div>

            {status === "loading" && <LoadingState />}
            {status === "error" && (
              <ErrorState message={errorMessage} onRetry={() => loadFeed(agentId)} />
            )}
            {status === "success" && posts.length === 0 && <EmptyState />}
            {status === "success" && posts.length > 0 && <PostFeed posts={posts} />}
          </main>
        </>
      )}
    </div>
  );
}