import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import "./PetTracker.css";

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
  const [deviceMissing, setDeviceMissing] = useState(false);
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
        const res = await axios.get(`${API_BASE_URL}/api/simulator/devices/${pet.deviceId}/status`);
        if (!cancelled) {
          setStatus(res.data);
          setDeviceMissing(false);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(null);
          setDeviceMissing(err.response?.status === 404);
        }
      }
    };

    fetchStatus();
    pollRef.current = setInterval(fetchStatus, SIMULATOR_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [isPaired, isSimulator, pet.deviceId]);

  // Best-effort stop when the tab is closed/refreshed while a simulator run
  // is active. sendBeacon fires even as the page unloads, unlike a normal
  // axios/fetch call, which the browser would otherwise cancel. This is a
  // courtesy on top of, not a replacement for, the server-side MAX_RUN_MS
  // auto-stop in iotSimulatorService.js, which is what actually guarantees a
  // run can't outlive the tab indefinitely.
  useEffect(() => {
    if (!isPaired || !isSimulator || !SIMULATOR_UI_ENABLED) return undefined;

    const stopOnClose = () => {
      if (status?.running) {
        navigator.sendBeacon(`${API_BASE_URL}/api/simulator/devices/${pet.deviceId}/stop`);
      }
    };

    window.addEventListener("pagehide", stopOnClose);
    return () => window.removeEventListener("pagehide", stopOnClose);
  }, [isPaired, isSimulator, pet.deviceId, status?.running]);

  // Simulator devices only live in the backend's in-memory registry (see
  // iotSimulatorService.js) — a backend restart wipes them even though the
  // pet's deviceId in Mongo still points at the old one. Surface that
  // specific case instead of a generic failure so it's clear a new
  // simulator device needs to be created, not just retried.
  const describeSimulatorError = (err, fallback) => {
    if (err.response?.status === 404) {
      setDeviceMissing(true);
      return "This simulator device no longer exists on the server (the backend was likely restarted). Create a new simulator device to continue testing.";
    }
    return err.response?.data?.error || fallback;
  };

  const pairDevice = async (deviceId) => {
    setBusy("pair");
    setError(null);
    try {
      await axios.put(`${API_BASE_URL}/pet/update/${pet._id}`, { deviceId });
      onDeviceIdChange(deviceId);
      setDeviceIdInput("");
      setPendingSimulatorId(null);
      setDeviceMissing(false);
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
      const res = await axios.post(`${API_BASE_URL}/api/simulator/devices`);
      setPendingSimulatorId(res.data.deviceId);
      setDeviceMissing(false);
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
      const res = await axios.post(`${API_BASE_URL}/api/simulator/devices/${pet.deviceId}/start`);
      setStatus(res.data);
      setDeviceMissing(false);
    } catch (err) {
      setError(describeSimulatorError(err, "Could not start the simulator device."));
    } finally {
      setBusy(null);
    }
  };

  const handleStop = async () => {
    setBusy("stop");
    setError(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/simulator/devices/${pet.deviceId}/stop`);
      setStatus(res.data);
      setDeviceMissing(false);
    } catch (err) {
      setError(describeSimulatorError(err, "Could not stop the simulator device."));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteDevice = async () => {
    if (!window.confirm("Remove this tracker from the pet? This can be done at any time, even while it has recorded data.")) {
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      if (isSimulator) {
        // Best-effort: the simulator device may already be gone (e.g. a
        // backend restart), which is fine — we're removing it either way.
        try {
          await axios.delete(`${API_BASE_URL}/api/simulator/devices/${pet.deviceId}`);
        } catch (err) {
          if (err.response?.status !== 404) throw err;
        }
      }
      await axios.put(`${API_BASE_URL}/pet/update/${pet._id}`, { deviceId: null });
      onDeviceIdChange(null);
      setStatus(null);
      setDeviceMissing(false);
    } catch (err) {
      setError("Could not remove this device. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleReplaceMissingDevice = async () => {
    setBusy("create");
    setError(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/simulator/devices`);
      const newDeviceId = String(res.data.deviceId);
      await axios.put(`${API_BASE_URL}/pet/update/${pet._id}`, { deviceId: newDeviceId });
      onDeviceIdChange(newDeviceId);
      setDeviceMissing(false);
      setStatus(null);
    } catch (err) {
      setError("Could not create a replacement simulator device.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="pwh-tracker-card" aria-labelledby="tracker-title">
      <div className="pwh-tracker-card__header">
        <h2 id="tracker-title">Pet Health Tracker</h2>
        {isPaired && (
          <span className={`pwh-tracker-badge ${isSimulator ? "pwh-tracker-badge--simulator" : "pwh-tracker-badge--physical"}`}>
            {isSimulator ? "Simulator" : "Physical device"}
          </span>
        )}
      </div>

      {error && <p className="pwh-tracker-error">{error}</p>}

      {!isPaired && !pendingSimulatorId && (
        <div className="pwh-tracker-state">
          <p className="pwh-tracker-state__title">No tracker connected</p>
          <p className="pwh-tracker-state__hint">
            Connect a physical tracker or create a simulator for testing.
          </p>

          <div className="pwh-tracker-connect-row">
            <label htmlFor="tracker-device-id" className="sr-only">Device ID</label>
            <input
              id="tracker-device-id"
              type="text"
              inputMode="numeric"
              placeholder="Device ID"
              value={deviceIdInput}
              onChange={(e) => setDeviceIdInput(e.target.value)}
              className="pwh-tracker-input"
            />
            <button
              type="button"
              className="pwh-tracker-button pwh-tracker-button--primary"
              onClick={handleConnect}
              disabled={busy === "pair"}
            >
              {busy === "pair" ? "Connecting…" : "Connect"}
            </button>
          </div>

          {SIMULATOR_UI_ENABLED && (
            <>
              <div className="pwh-tracker-divider"><span>or</span></div>
              <button
                type="button"
                className="pwh-tracker-button pwh-tracker-button--secondary"
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
        <div className="pwh-tracker-state">
          <p className="pwh-tracker-state__title">Simulator Device Ready</p>
          <dl className="pwh-tracker-facts">
            <div>
              <dt>Device ID</dt>
              <dd>{pendingSimulatorId}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Not paired</dd>
            </div>
          </dl>
          <div className="pwh-tracker-actions">
            <button
              type="button"
              className="pwh-tracker-button pwh-tracker-button--primary"
              onClick={() => pairDevice(String(pendingSimulatorId))}
              disabled={busy === "pair"}
            >
              {busy === "pair" ? "Connecting…" : "Connect to this pet"}
            </button>
            <button
              type="button"
              className="pwh-tracker-button pwh-tracker-button--ghost"
              onClick={() => setPendingSimulatorId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isPaired && (
        <div className="pwh-tracker-state">
          <dl className="pwh-tracker-facts">
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
                  ? (deviceMissing ? "Not found" : status ? (status.running ? "Running" : "Stopped") : "Unknown")
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

          <div className="pwh-tracker-actions">
            <button
              type="button"
              className="pwh-tracker-button pwh-tracker-button--primary"
              onClick={() => navigate(`/pet/${pet.deviceId}`)}
            >
              Open Dashboard
            </button>
            <button
              type="button"
              className="pwh-tracker-button pwh-tracker-button--ghost"
              onClick={handleDeleteDevice}
              disabled={busy === "delete"}
            >
              {busy === "delete" ? "Removing…" : "Remove Device"}
            </button>
          </div>

          {isSimulator && SIMULATOR_UI_ENABLED && (
            <div className="pwh-tracker-simulator-controls">
              <p className="pwh-tracker-simulator-controls__label">Simulator controls</p>

              {deviceMissing ? (
                <>
                  <p className="pwh-tracker-state__hint">
                    This simulator device no longer exists on the server (the backend was likely restarted since it was created).
                  </p>
                  <div className="pwh-tracker-actions">
                    <button
                      type="button"
                      className="pwh-tracker-button pwh-tracker-button--secondary"
                      onClick={handleReplaceMissingDevice}
                      disabled={busy === "create"}
                    >
                      {busy === "create" ? "Creating…" : "Create New Simulator Device"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="pwh-tracker-actions">
                  <button
                    type="button"
                    className="pwh-tracker-button pwh-tracker-button--secondary"
                    onClick={handleStart}
                    disabled={busy === "start" || Boolean(status?.running)}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    className="pwh-tracker-button pwh-tracker-button--ghost"
                    onClick={handleStop}
                    disabled={busy === "stop" || !status?.running}
                  >
                    Stop
                  </button>
                </div>
              )}
              {status?.lastError && (
                <p className="pwh-tracker-warning">Last error: {status.lastError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default PetTracker;
