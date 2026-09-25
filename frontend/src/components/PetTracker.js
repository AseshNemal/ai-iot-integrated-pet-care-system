import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./PetTracker.css";

const API_BASE = "http://localhost:8090";
const SIMULATOR_UI_ENABLED = process.env.REACT_APP_ENABLE_IOT_SIMULATOR_UI === "true";
const SIMULATOR_POLL_MS = 5000;

// Simulator devices are allocated starting at this ID by the backend
// (backend/src/services/iotSimulatorService.js, SIMULATOR_ID_RANGE_START) so
// simulated and physical trackers stay visually distinguishable without a
// Pet schema change.
const SIMULATOR_ID_RANGE_START = 900001;

function isSimulatorDeviceId(deviceId) {
  const numeric = Number(deviceId);
  return !Number.isNaN(numeric) && numeric >= SIMULATOR_ID_RANGE_START;
}

// Telemetry timestamps arrive as "DD/MM/YYYY, HH:MM:SS" (see deviceData.js
// and docs/IOT_SIMULATOR.md). Reuses the same split-based parsing already
// established there for this exact format.
function timeAgo(timestamp) {
  if (!timestamp) return null;
  try {
    const [datePart, timePart] = timestamp.split(", ");
    const [day, month, year] = datePart.split("/");
    const parsed = new Date(`${year}-${month}-${day}T${timePart}`);
    const seconds = Math.round((Date.now() - parsed.getTime()) / 1000);
    if (Number.isNaN(seconds)) return timestamp;
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    return `${hours}h ago`;
  } catch {
    return timestamp;
  }
}

const PetTracker = ({ pet, onDeviceIdChange }) => {
  const navigate = useNavigate();
  const [deviceIdInput, setDeviceIdInput] = useState("");
  const [pendingSimulatorId, setPendingSimulatorId] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const isPaired = Boolean(pet.deviceId);
  const isSimulator = isPaired && isSimulatorDeviceId(pet.deviceId);

  useEffect(() => {
    if (!isPaired || !isSimulator || !SIMULATOR_UI_ENABLED) {
      setStatus(null);
      return undefined;
    }

    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/simulator/devices/${pet.deviceId}/status`);
        if (!cancelled) setStatus(res.data);
      } catch (err) {
        if (!cancelled) setStatus(null);
      }
    };

    fetchStatus();
    pollRef.current = setInterval(fetchStatus, SIMULATOR_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [isPaired, isSimulator, pet.deviceId]);

  const pairDevice = async (deviceId) => {
    setBusy("pair");
    setError(null);
    try {
      await axios.put(`${API_BASE}/pet/update/${pet._id}`, { deviceId });
      onDeviceIdChange(deviceId);
      setDeviceIdInput("");
      setPendingSimulatorId(null);
    } catch (err) {
      setError("Could not pair that device. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleConnect = () => {
    if (!deviceIdInput.trim()) {
      setError("Enter a device ID first.");
      return;
    }
    pairDevice(deviceIdInput.trim());
  };

  const handleCreateSimulator = async () => {
    setBusy("create");
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/simulator/devices`);
      setPendingSimulatorId(res.data.deviceId);
    } catch (err) {
      setError("Could not create a simulator device. Is the simulator enabled on the backend?");
    } finally {
      setBusy(null);
    }
  };

  const handleStart = async () => {
    setBusy("start");
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/simulator/devices/${pet.deviceId}/start`);
      setStatus(res.data);
    } catch (err) {
      setError("Could not start the simulator device.");
    } finally {
      setBusy(null);
    }
  };

  const handleStop = async () => {
    setBusy("stop");
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/api/simulator/devices/${pet.deviceId}/stop`);
      setStatus(res.data);
    } catch (err) {
      setError("Could not stop the simulator device.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="tracker-card" aria-labelledby="tracker-title">
      <div className="tracker-card__header">
        <h2 id="tracker-title">Pet Health Tracker</h2>
        {isPaired && (
          <span className={`tracker-badge ${isSimulator ? "tracker-badge--simulator" : "tracker-badge--physical"}`}>
            {isSimulator ? "Simulator" : "Physical device"}
          </span>
        )}
      </div>

      {error && <p className="tracker-error">{error}</p>}

      {!isPaired && !pendingSimulatorId && (
        <div className="tracker-state tracker-state--empty">
          <p className="tracker-state__title">No tracker connected</p>
          <p className="tracker-state__hint">
            Connect a physical tracker or create a simulator for testing.
          </p>

          <div className="tracker-connect-row">
            <label htmlFor="tracker-device-id" className="sr-only">Device ID</label>
            <input
              id="tracker-device-id"
              type="text"
              inputMode="numeric"
              placeholder="Device ID"
              value={deviceIdInput}
              onChange={(e) => setDeviceIdInput(e.target.value)}
              className="tracker-input"
            />
            <button
              type="button"
              className="tracker-button tracker-button--primary"
              onClick={handleConnect}
              disabled={busy === "pair"}
            >
              {busy === "pair" ? "Connecting…" : "Connect"}
            </button>
          </div>

          {SIMULATOR_UI_ENABLED && (
            <>
              <div className="tracker-divider"><span>or</span></div>
              <button
                type="button"
                className="tracker-button tracker-button--secondary"
                onClick={handleCreateSimulator}
                disabled={busy === "create"}
              >
                {busy === "create" ? "Creating…" : "Create Simulator Device"}
              </button>
            </>
          )}
        </div>
      )}

      {!isPaired && pendingSimulatorId && (
        <div className="tracker-state tracker-state--pending">
          <p className="tracker-state__title">Simulator Device Ready</p>
          <dl className="tracker-facts">
            <div>
              <dt>Device ID</dt>
              <dd>{pendingSimulatorId}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Not paired</dd>
            </div>
          </dl>
          <div className="tracker-actions">
            <button
              type="button"
              className="tracker-button tracker-button--primary"
              onClick={() => pairDevice(String(pendingSimulatorId))}
              disabled={busy === "pair"}
            >
              {busy === "pair" ? "Connecting…" : "Connect to this pet"}
            </button>
            <button
              type="button"
              className="tracker-button tracker-button--ghost"
              onClick={() => setPendingSimulatorId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isPaired && (
        <div className="tracker-state tracker-state--connected">
          <dl className="tracker-facts">
            <div>
              <dt>Device</dt>
              <dd>{pet.deviceId}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{isSimulator ? "Simulator" : "Physical"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {isSimulator && SIMULATOR_UI_ENABLED
                  ? (status ? (status.running ? "Running" : "Stopped") : "Unknown")
                  : "Paired"}
              </dd>
            </div>
            <div>
              <dt>Last update</dt>
              <dd>
                {isSimulator && status?.lastTelemetry?.timestamp
                  ? timeAgo(status.lastTelemetry.timestamp)
                  : "—"}
              </dd>
            </div>
          </dl>

          <div className="tracker-actions">
            <button
              type="button"
              className="tracker-button tracker-button--primary"
              onClick={() => navigate(`/pet/${pet.deviceId}`)}
            >
              Open Dashboard
            </button>
          </div>

          {isSimulator && SIMULATOR_UI_ENABLED && (
            <div className="tracker-simulator-controls">
              <p className="tracker-simulator-controls__label">Simulator controls</p>
              <div className="tracker-actions">
                <button
                  type="button"
                  className="tracker-button tracker-button--secondary"
                  onClick={handleStart}
                  disabled={busy === "start" || Boolean(status?.running)}
                >
                  Start
                </button>
                <button
                  type="button"
                  className="tracker-button tracker-button--ghost"
                  onClick={handleStop}
                  disabled={busy === "stop" || !status?.running}
                >
                  Stop
                </button>
              </div>
              {status?.lastError && (
                <p className="tracker-warning">Last error: {status.lastError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default PetTracker;
