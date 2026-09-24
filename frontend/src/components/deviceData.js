import React, { useState, useEffect } from "react";
import { realtimeDB } from "../firebase";
import { ref, onValue } from "firebase/database";
import { Line } from "react-chartjs-2";
import { useParams } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import "./deviceData.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

// Simulator devices are allocated starting at this ID by the backend
// (backend/src/services/iotSimulatorService.js, SIMULATOR_ID_RANGE_START),
// which is how a paired device is told apart from a physical tracker here.
const SIMULATOR_ID_RANGE_START = 900001;
const STEP_GOAL = 5000;

const DeviceData = () => {
  const [deviceData, setDeviceData] = useState([]);
  const [latestData, setLatestData] = useState(null);
  const [location, setLocation] = useState({ lat: 6.914716310240717, lng: 79.9728071125578 });
  const [count, setCount] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedDeviceData, setSelectedDeviceData] = useState(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { deviceId } = useParams();

  useEffect(() => {
    const dataRef = ref(realtimeDB, "petcare");

    onValue(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        const rawData = snapshot.val();
        console.log("Firebase Data:", rawData);

        const formattedData = Object.keys(rawData).map((key) => ({
          id: key,
          DeviceID: rawData[key]["Device ID"] || "Unknown",
          Latitude: rawData[key].Latitude ? Number(rawData[key].Latitude) : null,
          Longitude: rawData[key].Longitude ? Number(rawData[key].Longitude) : null,
          Altitude: rawData[key].Altitude || "N/A",
          BatteryLevel: rawData[key].Battery ? Number(rawData[key].Battery) : -1,
          En_Temperature: rawData[key].En_temperature ? Number(rawData[key].En_temperature) : 0,
          En_Humidity: rawData[key].en_humidity ? Number(rawData[key].en_humidity) : 0,
          AirQuality: rawData[key].AirQuality ? Number(rawData[key].AirQuality/4) : 0,
          Temperature: rawData[key].Temperature ? Number(rawData[key].Temperature) : 0,
          HeartRate: rawData[key].hartrate ? Number(rawData[key].hartrate/5) : 0,
          Steps: rawData[key].step ? Number(rawData[key].step) : 0,
          Timestamp: rawData[key].timestamp || "No timestamp",
        }));

        const sortedData = formattedData.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
        setDeviceData(sortedData);

        const recordCount = sortedData.length;
        console.log("Number of records:", recordCount);

        const latestRecord = sortedData[recordCount - 1];
        setLatestData(latestRecord);
        setCount(recordCount);

        setSelectedDeviceId(deviceId)
        if (selectedDeviceId) {
          const device = sortedData.find(item => item.DeviceID === selectedDeviceId);
          setSelectedDeviceData(device || null);
        }

        if (latestRecord && latestRecord.Latitude && latestRecord.Longitude) {
          fetchLocation(latestRecord.Latitude, latestRecord.Longitude);
        }
      } else {
        console.log("No data found in Firebase.");
        setDeviceData([]);
      }
    });
  },[selectedDeviceId]);

  const fetchLocation = (latitude, longitude) => {
    console.log(`Attempting to update location with Latitude: ${latitude}, Longitude: ${longitude}`);
    if (!isNaN(latitude) && !isNaN(longitude)) {
      setLocation({ lat: latitude, lng: longitude });
      console.log("Location updated successfully.");
    } else {
      console.log("Invalid coordinates:", latitude, longitude);
    }
  };

  const last20Records = selectedDeviceId
    ? deviceData.filter(d => d.DeviceID === selectedDeviceId).slice(-20)
    : deviceData.slice(count - 21, count - 1);

  const last30Records = selectedDeviceId
    ? deviceData.filter(d => d.DeviceID === selectedDeviceId).slice(-30)
    : deviceData.slice(count - 30, count - 1);

  const historyRecords = showAllHistory ? last30Records : last20Records;

  // Temperature Chart Data
  const temperatureChartData = {
    labels: last20Records.map((data) => data.Timestamp),
    datasets: [
      {
        label: "Temperature (°C)",
        data: last20Records.map((data) => data.Temperature),
        fill: false,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        tension: 0.4,
      },
    ],
  };

  // Heart Rate Chart Data
  const heartRateChartData = {
    labels: last20Records.map((data) => data.Timestamp),
    datasets: [
      {
        label: "Heart Rate (BPM)",
        data: last20Records.map((data) => data.HeartRate),
        fill: false,
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(51, 22, 28, 0.5)",
        tension: 0.4,
      },
    ],
  };

  // Step Rate Chart Data
  const stepRateChartData = {
    labels: last20Records.map((data) => data.Timestamp),
    datasets: [
      {
        label: "Steps",
        data: last20Records.map((data) => data.Steps),
        fill: false,
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        tension: 0.4,
      },
    ],
  };

  // Chart Options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 20,
        max: 50,
        ticks: {
          stepSize: 5,
          callback: (value) => `${value}°C`,
        },
      },
    },
  };

  const stepchartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        ticks: {
          stepSize: 5,
          callback: (value) => `${value}`,
        },
      },
    },
  };

  const heartRateChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: 300,
        ticks: {
          stepSize: 25,
          callback: (value) => `${value} BPM`,
        },
      },
    },
  };

  const isDeviceConnected = latestData ? (
    (new Date() - new Date(
      latestData.Timestamp.split(", ")[0].split("/").reverse().join("-") + "T" +
      latestData.Timestamp.split(", ")[1]
    )) / 1000 / 60 <= 4
  ) : false;

  const handleRefresh = () => {
    window.location.reload();
  };

  const getStepsForToday = () => {
    const today = new Date();
    const todayDate = today.toISOString().split("T")[0];
    const todayData = deviceData.filter((data) => {
      const recordDate = new Date(data.Timestamp.split(", ")[0].split("/").reverse().join("-"));
      return recordDate.toISOString().split("T")[0] === todayDate;
    });
    return todayData.reduce((acc, data) => acc + data.Steps, 0);
  };

  const totalStepsToday = getStepsForToday();
  const stepGoalPercent = Math.min(100, Math.round((totalStepsToday / STEP_GOAL) * 100));

  const generateHealthSuggestions = () => {
    if (!latestData) return [];

    const suggestions = [];
    const now = new Date();
    const lastUpdate = new Date(
      latestData.Timestamp.split(", ")[0].split("/").reverse().join("-") + "T" +
      latestData.Timestamp.split(", ")[1]
    );
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

    // Device connection status
    if (hoursSinceUpdate > 4) {
      suggestions.push({
        type: 'warning',
        message: 'Device has not sent data in over 4 hours. Check device connectivity and battery.'
      });
    }

    // Battery level check
    if (latestData.BatteryLevel >= 0) { // Only show if battery data is available
      if (latestData.BatteryLevel < 20) {
        suggestions.push({
          type: 'danger',
          message: `Low battery level (${latestData.BatteryLevel}%). Please charge the device soon.`
        });
      } else if (latestData.BatteryLevel < 40) {
        suggestions.push({
          type: 'warning',
          message: `Battery level is getting low (${latestData.BatteryLevel}%). Consider charging the device.`
        });
      }
    }

    // Temperature suggestions
    if (latestData.Temperature > 39.5) {
      suggestions.push({
        type: 'danger',
        message: 'High body temperature detected. Consider consulting a veterinarian as this could indicate fever or heat stress.'
      });
    } else if (latestData.Temperature < 37.5) {
      suggestions.push({
        type: 'danger',
        message: 'Low body temperature detected. This could indicate hypothermia. Keep your pet warm and consult a veterinarian.'
      });
    }

    // Heart rate suggestions
    if (latestData.HeartRate > 180) {
      suggestions.push({
        type: 'danger',
        message: 'Elevated heart rate detected. This could indicate stress, pain, or cardiac issues. Monitor closely.'
      });
    } else if (latestData.HeartRate < 60) {
      suggestions.push({
        type: 'danger',
        message: 'Low heart rate detected. This could indicate health issues. Consult a veterinarian if this persists.'
      });
    }

    // Activity suggestions
    if (latestData.Steps < 1000 && totalStepsToday < 3000) {
      suggestions.push({
        type: 'warning',
        message: 'Low activity level detected. Consider increasing exercise and playtime for your pet.'
      });
    } else if (latestData.Steps > 5000 || totalStepsToday > 15000) {
      suggestions.push({
        type: 'warning',
        message: 'High activity level detected. Ensure your pet has adequate rest and hydration.'
      });
    }

    // Environmental suggestions
    if (latestData.En_Temperature > 30) {
      suggestions.push({
        type: 'warning',
        message: 'High environment temperature. Ensure your pet has access to shade and fresh water to prevent overheating.'
      });
    } else if (latestData.En_Temperature < 15) {
      suggestions.push({
        type: 'warning',
        message: 'Low environment temperature. Provide warm bedding and shelter for your pet.'
      });
    }

    if (latestData.En_Humidity > 80) {
      suggestions.push({
        type: 'warning',
        message: 'High humidity detected. Ensure proper ventilation to prevent respiratory issues.'
      });
    } else if (latestData.En_Humidity < 30) {
      suggestions.push({
        type: 'warning',
        message: 'Low humidity detected. Consider using a humidifier if indoors to prevent dry skin.'
      });
    }

    if (latestData.AirQuality > 150) {
      suggestions.push({
        type: 'danger',
        message: 'Poor air quality detected. Consider improving ventilation or moving your pet to a cleaner air environment.'
      });
    }

    // General health check reminder
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'success',
        message: 'All vitals appear normal. Regular check-ups are still recommended for optimal pet health.'
      });
    }

    return suggestions;
  };

  const healthSuggestions = generateHealthSuggestions();

  const getBatteryColor = (level) => {
    if (level < 0) return "#cccccc"; // No data
    if (level < 20) return "#ff4444"; // Critical
    if (level < 40) return "#ffbb33"; // Warning
    return "#00C851"; // Good
  };

  const getBatteryIcon = (level) => {
    if (level < 0) return "❓"; // No data
    if (level < 20) return "🪫"; // Critical
    if (level < 40) return "🔋"; // Warning
    return "🔋"; // Good
  };

  // Telemetry timestamps are "DD/MM/YYYY, HH:MM:SS" (same shape parsed above
  // via split/reverse). Used only for the compact "time ago" hero label.
  const formatRelativeTime = (timestamp) => {
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
  };

  const activeDeviceId = selectedDeviceId || selectedDeviceData?.DeviceID || latestData?.DeviceID || "Unavailable";
  const activeDeviceIdNumeric = Number(activeDeviceId);
  const isSimulatorDevice = !Number.isNaN(activeDeviceIdNumeric) && activeDeviceIdNumeric >= SIMULATOR_ID_RANGE_START;
  const hasKnownDeviceType = !Number.isNaN(activeDeviceIdNumeric);

  const connectionLabel = deviceData.length > 0 && latestData
    ? (isDeviceConnected ? "Live" : "Offline")
    : "No data";
  const connectionClass = deviceData.length > 0 && latestData
    ? (isDeviceConnected ? "device-status--connected" : "device-status--offline")
    : "device-status--empty";

  const primaryMetrics = [
    {
      label: "Body temperature",
      value: latestData ? latestData.Temperature : "—",
      unit: latestData ? "°C" : "",
      symbol: "T",
      tone: "teal",
    },
    {
      label: "Heart rate",
      value: latestData ? latestData.HeartRate : "—",
      unit: latestData ? "BPM" : "",
      symbol: "♥",
      tone: "rose",
    },
    {
      label: "Battery",
      value: latestData && latestData.BatteryLevel >= 0 ? latestData.BatteryLevel : "—",
      unit: latestData && latestData.BatteryLevel >= 0 ? "%" : "",
      symbol: latestData ? getBatteryIcon(latestData.BatteryLevel) : "—",
      tone: "blue",
    },
    {
      label: "Steps today",
      value: totalStepsToday.toLocaleString(),
      unit: "steps",
      symbol: "S",
      tone: "violet",
    },
  ];

  const environmentMetrics = [
    {
      label: "Environment temperature",
      value: latestData ? latestData.En_Temperature : "—",
      unit: latestData ? "°C" : "",
      symbol: "T",
    },
    {
      label: "Humidity",
      value: latestData ? latestData.En_Humidity : "—",
      unit: latestData ? "%" : "",
      symbol: "H",
    },
    {
      label: "Air quality",
      value: latestData ? latestData.AirQuality : "—",
      unit: latestData ? "PPM" : "",
      symbol: "AQ",
    },
  ];

  return (
    <div className="pet-dashboard">
      <main className="pet-dashboard__shell">
        <section className="dashboard-hero" aria-labelledby="pet-tracker-title">
          <div className="dashboard-hero__identity">
            <p className="dashboard-hero__context">Live pet monitoring</p>
            <h1 id="pet-tracker-title">Pet Tracker</h1>
            <p className="dashboard-hero__device">
              Device <strong>{activeDeviceId}</strong>
              {hasKnownDeviceType && (
                <span className={`device-type-chip ${isSimulatorDevice ? "device-type-chip--simulator" : "device-type-chip--physical"}`}>
                  {isSimulatorDevice ? "Simulator" : "Physical device"}
                </span>
              )}
            </p>
          </div>

          <div className="dashboard-hero__status">
            <div className="dashboard-hero__status-row">
              <span className={`device-status ${connectionClass}`}>
                <span className="device-status__dot" aria-hidden="true" />
                {connectionLabel}
              </span>
              {latestData && latestData.BatteryLevel >= 0 && (
                <span
                  className="dashboard-hero__battery"
                  style={{ "--battery-color": getBatteryColor(latestData.BatteryLevel) }}
                >
                  <span aria-hidden="true">{getBatteryIcon(latestData.BatteryLevel)}</span>
                  {latestData.BatteryLevel}%
                </span>
              )}
            </div>
            <p className="dashboard-hero__updated" title={latestData?.Timestamp || undefined}>
              <span>Last update</span>
              <strong>{latestData?.Timestamp ? formatRelativeTime(latestData.Timestamp) : "Not available"}</strong>
            </p>
            <button className="dashboard-refresh" type="button" onClick={handleRefresh}>
              <span aria-hidden="true">↻</span>
              Reconnect
            </button>
          </div>
        </section>

        <section className="metric-grid metric-grid--primary" aria-label="Current health readings">
          {primaryMetrics.map((metric) => (
            <article className={`metric-card metric-card--${metric.tone}`} key={metric.label}>
              <div className="metric-card__heading">
                <span className="metric-card__symbol" aria-hidden="true">{metric.symbol}</span>
                <span>{metric.label}</span>
              </div>
              <p className="metric-card__value">
                {metric.value}
                {metric.unit && <span>{metric.unit}</span>}
              </p>
            </article>
          ))}
        </section>

        <section className="dashboard-card suggestions-card" aria-labelledby="suggestions-title">
          <div className="section-heading">
            <div>
              <h2 id="suggestions-title">Health alerts</h2>
              <p>Guidance based on the most recent available readings.</p>
            </div>
            <span className="section-heading__count">{healthSuggestions.length}</span>
          </div>
          {healthSuggestions.length > 0 ? (
            <div className="suggestions-list" aria-live="polite">
              {healthSuggestions.map((suggestion, index) => (
                <div className={`suggestion suggestion--${suggestion.type}`} key={index}>
                  <span className="suggestion__icon" aria-hidden="true">
                    {suggestion.type === "success" ? "✓" : "!"}
                  </span>
                  <p>{suggestion.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">No readings are available to generate suggestions yet.</p>
          )}
        </section>

        <section className="dashboard-section" aria-labelledby="health-trends-title">
          <div className="section-heading section-heading--outside">
            <div>
              <h2 id="health-trends-title">Health trends</h2>
              <p>Recent body temperature and heart rate readings.</p>
            </div>
          </div>
          <div className="chart-grid">
            <article className="dashboard-card chart-card">
              <div className="chart-card__heading">
                <h3>Body temperature</h3>
                <span>°C</span>
              </div>
              <div className="chart-frame">
                <Line data={temperatureChartData} options={chartOptions} />
              </div>
            </article>

            <article className="dashboard-card chart-card">
              <div className="chart-card__heading">
                <h3>Heart rate</h3>
                <span>BPM</span>
              </div>
              <div className="chart-frame">
                <Line data={heartRateChartData} options={heartRateChartOptions} />
              </div>
            </article>
          </div>
        </section>

        <section className="dashboard-section" aria-labelledby="activity-title">
          <div className="section-heading section-heading--outside">
            <div>
              <h2 id="activity-title">Activity &amp; environment</h2>
              <p>Movement progress and surrounding conditions.</p>
            </div>
          </div>
          <div className="chart-grid">
            <article className="dashboard-card chart-card activity-card">
              <div className="chart-card__heading">
                <h3>Steps</h3>
                <span>Goal {STEP_GOAL.toLocaleString()}/day</span>
              </div>
              <p className="activity-card__value">
                {totalStepsToday.toLocaleString()}<span> steps today</span>
              </p>
              <div className="progress-bar" role="progressbar" aria-valuenow={stepGoalPercent} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar__fill" style={{ width: `${stepGoalPercent}%` }} />
              </div>
              <p className="activity-card__goal">{stepGoalPercent}% of daily goal</p>
              <div className="chart-frame chart-frame--compact">
                <Line data={stepRateChartData} options={stepchartOptions} />
              </div>
            </article>

            <article className="dashboard-card env-card">
              <div className="chart-card__heading">
                <h3>Environment</h3>
                <span>Live readout</span>
              </div>
              <div className="env-compact">
                {environmentMetrics.map((metric) => (
                  <div className="env-compact__row" key={metric.label}>
                    <span className="env-compact__symbol" aria-hidden="true">{metric.symbol}</span>
                    <span className="env-compact__label">{metric.label}</span>
                    <span className="env-compact__value">
                      {metric.value}
                      {metric.unit && <span className="env-compact__unit">{metric.unit}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="dashboard-card map-card" aria-labelledby="location-title">
          <div className="section-heading">
            <div>
              <h2 id="location-title">Last known location</h2>
              <p>
                {latestData?.Latitude && latestData?.Longitude
                  ? `${latestData.Latitude}, ${latestData.Longitude}`
                  : "Location data is not available; showing the default area."}
              </p>
            </div>
          </div>
          <div className="map-card__canvas">
            <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
              <GoogleMap center={location} zoom={15} mapContainerStyle={{ width: "100%", height: "100%" }}>
                <Marker position={location} />
              </GoogleMap>
            </LoadScript>
          </div>
        </section>

        <section className="dashboard-card history-card" aria-labelledby="history-title">
          <div className="section-heading">
            <div>
              <h2 id="history-title">Recent telemetry</h2>
              <p>{selectedDeviceId ? `Filtered for device ${selectedDeviceId}` : "Latest available device readings"}</p>
            </div>
            <div className="history-card__actions">
              <span className="section-heading__count">{historyRecords.length}</span>
              <button
                type="button"
                className="history-toggle"
                onClick={() => setShowAllHistory((prev) => !prev)}
              >
                {showAllHistory ? "Show fewer" : "View all"}
              </button>
            </div>
          </div>
          <div className="device-table-wrap">
            <table className="device-table">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Battery</th>
                  <th>Temperature</th>
                  <th>Heart rate</th>
                  <th>Steps</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {historyRecords.length > 0 ? historyRecords.map((data, index) => (
                  <tr key={index}>
                    <td><strong>{data.DeviceID || "N/A"}</strong></td>
                    <td>{data.Latitude ?? "N/A"}</td>
                    <td>{data.Longitude ?? "N/A"}</td>
                    <td>{data.BatteryLevel >= 0 ? `${data.BatteryLevel}%` : "N/A"}</td>
                    <td>{data.Temperature ?? "N/A"}°C</td>
                    <td>{data.HeartRate ?? "N/A"} BPM</td>
                    <td>{data.Steps ?? "N/A"}</td>
                    <td>{data.Timestamp || "N/A"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="device-table__empty" colSpan="8">No recent device readings are available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DeviceData;
