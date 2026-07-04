import fs from "node:fs";
import path from "node:path";

const SIGNIFICANT_EVENT_PATTERN = /^(settings\.applied|media\.|image\.|pageAudio\.|scan\.|pagehide)/;

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const filePath = args.find(function (arg) {
    return arg !== "--json";
  });

  if (!filePath) {
    console.error("Usage: npm run analyze:diagnostics -- <diagnostics-log.json> [--json]");
    process.exitCode = 1;
    return;
  }

  const log = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  const analysis = analyzeLog(log);
  console.log(jsonOutput ? JSON.stringify(analysis, null, 2) : formatTextReport(analysis));
}

function analyzeLog(log) {
  const diagnostics = log.diagnostics || {};
  const entries = Array.isArray(diagnostics.entries) ? diagnostics.entries : [];
  const eventCounts = countEvents(entries);
  const effectiveSettings = log.effectiveSettings || {};
  const features = effectiveSettings.features || {};
  const tabStats = log.tabStats || {};
  const implementation = buildImplementation(eventCounts, entries);
  const featureMatrix = buildFeatureMatrix(features, tabStats, eventCounts);
  const quickRead = buildQuickRead(featureMatrix, implementation, eventCounts);

  return {
    page: log.page || {},
    generatedAt: log.generatedAt || "",
    copiedEntryCount: entries.length,
    reportedEntryCount: Number(diagnostics.entryCount || entries.length),
    frames: Array.isArray(diagnostics.frames) ? diagnostics.frames : [],
    effectiveFeatures: features,
    quickRead,
    featureMatrix,
    implementation,
    topEventCounts: eventCounts.slice(0, 15),
    recentSignificantEvents: summarizeRecentSignificantEvents(entries)
  };
}

function buildImplementation(eventCounts, entries) {
  return {
    maxNativeAudioElementsSeen: maxScanDetail(entries, "audioElements"),
    maxNativeVideoElementsSeen: maxScanDetail(entries, "videoElements"),
    maxNativeMediaElementsSeen: maxScanDetail(entries, "totalElements"),
    maxCustomMediaCandidatesSeen: maxScanDetail(entries, "uniqueCandidates"),
    nativeAudioPlayBlocks: countEvent(eventCounts, "pageAudio.media.audioPlayBlocked"),
    nativeVideoAudioEnforcements: countEvent(eventCounts, "pageAudio.media.videoAudioEnforced"),
    nativeVideoMuteActions: countEvent(eventCounts, "media.videoAudioMuted"),
    nativeVideoMuteActionsWithVolume: countEventMediaProperty(entries, "media.videoAudioMuted", "volume", function (value) { return value > 0; }),
    nativeVideoMuteMaxVolume: maxEventMediaProperty(entries, "media.videoAudioMuted", "volume"),
    pageMediaPlayCalls: countEvent(eventCounts, "pageAudio.media.playCalled"),
    videoUnmuteBlocks: countEvent(eventCounts, "pageAudio.media.videoUnmuteBlocked"),
    videoVolumeBlocks: countEvent(eventCounts, "pageAudio.media.videoVolumeBlocked"),
    webAudioEvents: countEventPrefix(eventCounts, "pageAudio.webAudio."),
    audioFetchEvents: countEventPrefix(eventCounts, "pageAudio.network.fetchAudio"),
    audioXhrEvents: countEventPrefix(eventCounts, "pageAudio.network.xhrAudio"),
    imageBlockEvents: countEvent(eventCounts, "image.nativeBlocked"),
    cssBackgroundBlockEvents: countEvent(eventCounts, "image.cssBackgroundBlocked")
  };
}

function buildFeatureMatrix(features, tabStats, eventCounts) {
  const counts = tabStats && tabStats.byFeature ? tabStats.byFeature : {};
  const evidenceByFeature = {
    animatedWebp: ["image.nativeBlocked", "image.cssBackgroundBlocked"],
    audio: ["media.videoAudioMuted", "pageAudio.media.videoAudioEnforced", "pageAudio.media.videoUnmuteBlocked", "pageAudio.media.videoVolumeBlocked", "media.nativeBlocked", "pageAudio.media.audioPlayBlocked", "pageAudio.webAudio.resumeBlocked", "pageAudio.webAudio.decodeBlocked", "pageAudio.network.fetchAudioBlocked", "pageAudio.network.xhrAudioBlocked"],
    autoplayVideo: ["media.autoplayDisabled", "media.decision"],
    cssMotion: [],
    emoji: [],
    gifs: ["image.nativeBlocked", "media.nativeBlocked", "media.decision"],
    gifv: ["media.nativeBlocked", "media.customHostBlocked", "media.decision"],
    images: ["image.nativeBlocked", "image.cssBackgroundBlocked"],
    video: ["media.nativeBlocked", "media.customHostBlocked", "media.decision"]
  };

  return Object.keys(features).reduce(function (matrix, key) {
    matrix[key] = {
      enabled: Boolean(features[key]),
      blockedCount: Math.max(0, Number(counts[key] || 0)),
      evidenceEvents: (evidenceByFeature[key] || []).filter(function (eventName) {
        return countEvent(eventCounts, eventName) > 0;
      })
    };
    return matrix;
  }, {});
}

function buildQuickRead(featureMatrix, implementation, eventCounts) {
  const notes = [];

  if (implementation.maxNativeVideoElementsSeen > 0) {
    notes.push("Native <video> elements were observed.");
  }
  if (implementation.maxNativeAudioElementsSeen > 0 || implementation.nativeAudioPlayBlocks > 0) {
    notes.push("Native <audio> usage was observed or blocked.");
  }
  if (implementation.webAudioEvents > 0) {
    notes.push("Web Audio API activity was observed.");
  }
  if (implementation.audioFetchEvents > 0 || implementation.audioXhrEvents > 0) {
    notes.push("Audio-like fetch/XHR requests were observed.");
  }
  if (implementation.imageBlockEvents > 0 || implementation.cssBackgroundBlockEvents > 0) {
    notes.push("Image/GIF/WebP-family block events were observed.");
  }
  if (implementation.nativeVideoMuteActions >= 5) {
    notes.push("Video audio was muted repeatedly; the site may be trying to unmute or replace the video.");
  }
  if (implementation.nativeVideoMuteActionsWithVolume > 0) {
    notes.push("Some video mute entries still had non-zero volume; current builds should force volume to 0 as well as muted=true.");
  }
  if (implementation.videoUnmuteBlocks > 0 || implementation.videoVolumeBlocks > 0) {
    notes.push("The page tried to restore native video audio; MotionBlock blocked unmute or volume changes in the page context.");
  }
  if (countEvent(eventCounts, "pageAudio.media.videoMutedBeforePlay") > 0) {
    notes.push("This log came from a build that muted video in the page play hook; current builds should not do that.");
  }

  Object.keys(featureMatrix).forEach(function (key) {
    const item = featureMatrix[key];
    if (item.enabled && item.blockedCount === 0 && item.evidenceEvents.length === 0) {
      notes.push(`${key} is enabled, but this log has no block evidence for that feature.`);
    }
  });

  return notes;
}

function countEvents(entries) {
  const counts = {};
  entries.forEach(function (entry) {
    const event = entry.event || "unknown";
    counts[event] = (counts[event] || 0) + 1;
  });
  return Object.keys(counts)
    .sort(function (a, b) {
      return counts[b] - counts[a] || a.localeCompare(b);
    })
    .map(function (event) {
      return { event, count: counts[event] };
    });
}

function countEvent(eventCounts, eventName) {
  const found = eventCounts.find(function (entry) {
    return entry.event === eventName;
  });
  return found ? found.count : 0;
}

function countEventPrefix(eventCounts, prefix) {
  return eventCounts.reduce(function (sum, entry) {
    return entry.event.indexOf(prefix) === 0 ? sum + entry.count : sum;
  }, 0);
}

function maxScanDetail(entries, key) {
  return entries.reduce(function (max, entry) {
    const value = entry.event && entry.event.indexOf("scan.") === 0 && entry.details ? Number(entry.details[key] || 0) : 0;
    return value > max ? value : max;
  }, 0);
}

function maxEventMediaProperty(entries, eventName, propertyName) {
  return entries.reduce(function (max, entry) {
    const value = entry.event === eventName ? getEntryMediaProperty(entry, propertyName) : 0;
    return value > max ? value : max;
  }, 0);
}

function countEventMediaProperty(entries, eventName, propertyName, predicate) {
  return entries.reduce(function (count, entry) {
    return entry.event === eventName && predicate(getEntryMediaProperty(entry, propertyName)) ? count + 1 : count;
  }, 0);
}

function getEntryMediaProperty(entry, propertyName) {
  const properties = entry.details && entry.details.properties;
  return properties ? Number(properties[propertyName] || 0) : 0;
}

function summarizeRecentSignificantEvents(entries) {
  return entries
    .map(function (entry, index) {
      return Object.assign({ index }, entry);
    })
    .filter(function (entry) {
      return SIGNIFICANT_EVENT_PATTERN.test(entry.event || "");
    })
    .slice(-20)
    .map(function (entry) {
      return {
        index: entry.index,
        time: entry.time || "",
        frameHost: entry.frameHost || "",
        event: entry.event || "",
        summary: summarizeEntryDetails(entry.details)
      };
    });
}

function summarizeEntryDetails(details) {
  const source = details && typeof details === "object" ? details : {};
  const reason = source.reason && source.reason.label ? source.reason.label : source.reason || source.mediaReason || "";
  return {
    action: source.action || "",
    feature: source.feature || "",
    reason,
    tag: source.tag || "",
    media: source.properties
      ? {
          muted: Boolean(source.properties.muted),
          paused: Boolean(source.properties.paused),
          readyState: Number(source.properties.readyState || 0),
          volume: Number(source.properties.volume || 0)
        }
      : undefined
  };
}

function formatTextReport(analysis) {
  return [
    `MotionBlock diagnostics analysis`,
    `Page: ${analysis.page.host || "(unknown)"} (${analysis.page.status || "unknown"})`,
    `Entries: ${analysis.copiedEntryCount}/${analysis.reportedEntryCount}`,
    "",
    "Quick read:",
    ...formatBullets(analysis.quickRead),
    "",
    "Feature matrix:",
    ...Object.keys(analysis.featureMatrix).map(function (key) {
      const item = analysis.featureMatrix[key];
      const evidence = item.evidenceEvents.length ? item.evidenceEvents.join(", ") : "none";
      return `- ${key}: enabled=${item.enabled}, blockedCount=${item.blockedCount}, evidence=${evidence}`;
    }),
    "",
    "Implementation:",
    ...Object.keys(analysis.implementation).map(function (key) {
      return `- ${key}: ${analysis.implementation[key]}`;
    }),
    "",
    "Top events:",
    ...analysis.topEventCounts.map(function (entry) {
      return `- ${entry.event}: ${entry.count}`;
    }),
    "",
    "Recent significant events:",
    ...analysis.recentSignificantEvents.map(function (entry) {
      return `- [${entry.index}] ${entry.time} ${entry.frameHost} ${entry.event} ${formatSummary(entry.summary)}`.trim();
    })
  ].join("\n");
}

function formatBullets(items) {
  return items.length ? items.map(function (item) { return `- ${item}`; }) : ["- No immediate findings from the captured events."];
}

function formatSummary(summary) {
  const parts = [];
  ["action", "feature", "reason", "tag"].forEach(function (key) {
    if (summary[key]) {
      parts.push(`${key}=${summary[key]}`);
    }
  });
  if (summary.media) {
    parts.push(`muted=${summary.media.muted}`);
    parts.push(`paused=${summary.media.paused}`);
    parts.push(`readyState=${summary.media.readyState}`);
  }
  return parts.length ? `(${parts.join(", ")})` : "";
}

main();
