const crypto = require("crypto");

const NODE_PROFILE = {
  "node-001": {
    tempBase: 28.2,
    humidityBase: 71,
    pressureBase: 1013,
    luxMax: 720,
    windBase: 3.1,
  },
  "node-002": {
    tempBase: 27.4,
    humidityBase: 73,
    pressureBase: 1012.3,
    luxMax: 690,
    windBase: 3.6,
  },
  "node-003": {
    tempBase: 29.1,
    humidityBase: 69,
    pressureBase: 1011.8,
    luxMax: 710,
    windBase: 2.8,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function fixed(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function dayFactor(timestampSec) {
  const d = new Date(timestampSec * 1000);
  const hours = d.getHours() + d.getMinutes() / 60;
  return Math.sin(((hours - 6) * Math.PI) / 12);
}

function inferEventType(reading, probability) {
  if (probability < 0.35) return null;
  if (reading.rain_level >= 8) return "HEAVY_RAIN";
  if (reading.wind_speed >= 15) return "STRONG_WIND";
  if (reading.temperature >= 38) return "HEATWAVE";
  return "WEATHER_SHIFT";
}

function calculateAnomalyScore(reading, previousReading) {
  let score = 0.04 + randomBetween(0, 0.08);

  if (reading.temperature >= 37 || reading.temperature <= 15) score += 0.28;
  if (reading.humidity >= 94 || reading.humidity <= 25) score += 0.2;
  if (reading.pressure <= 1001 || reading.pressure >= 1024) score += 0.18;
  if (reading.wind_speed >= 15) score += 0.2;
  if (reading.rain_level >= 8) score += 0.22;

  if (previousReading) {
    const tempJump = Math.abs(reading.temperature - previousReading.temperature);
    const pressureDrop = previousReading.pressure - reading.pressure;

    if (tempJump >= 3.5) score += 0.14;
    if (pressureDrop >= 6) score += 0.2;
  }

  return clamp(fixed(score, 3), 0, 1);
}

function generateSensorReading(nodeId, timestampSec, previousReading = null) {
  const profile = NODE_PROFILE[nodeId] || NODE_PROFILE["node-001"];
  const sunlight = dayFactor(timestampSec);
  const rainChanceBoost = sunlight < -0.15 ? 0.12 : 0;

  const temperature = fixed(
    profile.tempBase + sunlight * 6 + randomBetween(-1.4, 1.4),
    1
  );
  const humidity = fixed(
    clamp(profile.humidityBase - sunlight * 15 + randomBetween(-3, 3), 25, 98),
    1
  );
  const pressureTrend = previousReading
    ? (previousReading.pressure - profile.pressureBase) * 0.6
    : 0;
  const pressure = fixed(
    clamp(
      profile.pressureBase + randomBetween(-3.4, 3.4) + pressureTrend * 0.15,
      995,
      1030
    ),
    1
  );
  const luminosity = fixed(Math.max(0, profile.luxMax * sunlight + randomBetween(0, 90)), 0);
  const rainRandom = Math.random();
  const rainLevel = fixed(
    rainRandom > 0.85 - rainChanceBoost ? randomBetween(2, 14) : randomBetween(0, 1.6),
    2
  );
  const windSpeed = fixed(
    clamp(
      profile.windBase +
        randomBetween(0.4, 4.8) +
        (rainLevel > 7 ? randomBetween(2, 5) : 0),
      0.1,
      26
    ),
    1
  );

  const reading = {
    id: crypto.randomUUID(),
    node_id: nodeId,
    timestamp: timestampSec,
    temperature,
    humidity,
    pressure,
    luminosity,
    rain_level: rainLevel,
    wind_speed: windSpeed,
  };

  const anomalyScore = calculateAnomalyScore(reading, previousReading);
  const isAnomaly = anomalyScore >= 0.7 ? 1 : 0;

  return {
    ...reading,
    anomaly_score: anomalyScore,
    is_anomaly: isAnomaly,
  };
}

function buildAlertsFromReading(reading, previousReading = null) {
  const alerts = [];

  if (reading.temperature >= 38.5) {
    alerts.push({
      type: "TEMP",
      severity: "critical",
      message: `Température critique détectée : ${reading.temperature}°C`,
    });
  } else if (reading.temperature >= 36.5) {
    alerts.push({
      type: "TEMP",
      severity: "warning",
      message: `Température élevée : ${reading.temperature}°C`,
    });
  }

  if (reading.rain_level >= 10) {
    alerts.push({
      type: "RAIN",
      severity: "critical",
      message: `Précipitation intense : ${reading.rain_level} mm/h`,
    });
  }

  if (reading.wind_speed >= 18) {
    alerts.push({
      type: "WIND",
      severity: "warning",
      message: `Vent fort détecté : ${reading.wind_speed} m/s`,
    });
  }

  if (previousReading && previousReading.pressure - reading.pressure >= 6) {
    alerts.push({
      type: "PRESSURE",
      severity: "warning",
      message: `Chute de pression rapide : -${fixed(
        previousReading.pressure - reading.pressure,
        1
      )} hPa`,
    });
  }

  if (reading.is_anomaly) {
    alerts.push({
      type: "ANOMALY",
      severity: reading.anomaly_score > 0.85 ? "critical" : "warning",
      message: `Anomalie IA détectée (score ${(reading.anomaly_score * 100).toFixed(0)}%)`,
    });
  }

  return alerts;
}

function buildPredictionSet(latestReading) {
  const horizons = [3, 6, 12, 24];
  const base = latestReading || {
    temperature: 28,
    humidity: 70,
    pressure: 1012,
    wind_speed: 4,
    rain_level: 1,
    anomaly_score: 0.15,
    timestamp: Math.floor(Date.now() / 1000),
  };

  return horizons.map((horizonHours) => {
    const futureTimestamp = base.timestamp + horizonHours * 3600;
    const futureSun = dayFactor(futureTimestamp);

    const predictedTemp = fixed(
      clamp(base.temperature + futureSun * 2.8 + randomBetween(-1.4, 1.4), 16, 43),
      1
    );
    const predictedHumidity = fixed(
      clamp(base.humidity - futureSun * 8 + randomBetween(-5, 5), 30, 98),
      0
    );
    const predictedPressure = fixed(
      clamp(base.pressure + randomBetween(-4.5, 4.5) - base.rain_level * 0.1, 998, 1032),
      0
    );

    const riskRaw =
      0.08 +
      (predictedTemp >= 36 ? 0.14 : 0) +
      (predictedHumidity >= 88 ? 0.12 : 0) +
      (predictedPressure <= 1004 ? 0.15 : 0) +
      (base.wind_speed >= 14 ? 0.12 : 0) +
      (base.rain_level >= 8 ? 0.16 : 0) +
      base.anomaly_score * 0.22 +
      randomBetween(0, 0.1);

    const probability = clamp(fixed(riskRaw, 2), 0.03, 0.95);
    const ghostReading = {
      ...base,
      temperature: predictedTemp,
      humidity: predictedHumidity,
      pressure: predictedPressure,
      rain_level: base.rain_level,
      wind_speed: base.wind_speed,
    };

    return {
      horizon_hours: horizonHours,
      predicted_temp: predictedTemp,
      predicted_humidity: predictedHumidity,
      predicted_pressure: predictedPressure,
      extreme_event_probability: probability,
      event_type: inferEventType(ghostReading, probability),
    };
  });
}

module.exports = {
  buildAlertsFromReading,
  buildPredictionSet,
  calculateAnomalyScore,
  generateSensorReading,
};
