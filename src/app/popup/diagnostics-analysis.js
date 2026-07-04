(function (root) {
  "use strict";

  function buildDiagnosticsAnalysis(diagnostics, effective, tabStats) {
    const entries = normalizeEntries(diagnostics);
    const eventCounts = countEvents(entries);
    const featureMatrix = buildFeatureMatrix(effective, tabStats, eventCounts);
    const implementation = {
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
    const quickRead = buildQuickRead(eventCounts, implementation, effective, featureMatrix);

    return {
      audioBlockingEnabled: Boolean(effective && effective.enabled && effective.features && effective.features.audio),
      howToRead: [
        "Start with quickRead for likely causes.",
        "Use featureMatrix to see which blockers were enabled, counted, and evidenced.",
        "Use implementation to identify whether the site used native media, Web Audio, fetch/XHR, custom hosts, or image paths.",
        "Use recentSignificantEvents to jump into the raw diagnostics entries below."
      ],
      quickRead,
      featureMatrix,
      implementation,
      topEventCounts: eventCounts.slice(0, 12),
      recentSignificantEvents: summarizeRecentSignificantEvents(entries),
      recentAudioEvents: entries
        .filter(function (entry) {
          return /audio|Audio|media\.videoAudioMuted/.test(entry.event || "");
        })
        .slice(-12)
        .map(function (entry) {
          return { event: entry.event, frameHost: entry.frameHost || "", time: entry.time };
        })
    };
  }

  function buildQuickRead(eventCounts, implementation, effective, featureMatrix) {
    const notes = [];
    const audioBlocking = Boolean(effective && effective.enabled && effective.features && effective.features.audio);

    if (implementation.maxNativeVideoElementsSeen > 0) {
      notes.push("Native <video> elements were observed. Audio blocking should mute video audio without pausing video playback.");
    }
    if (implementation.maxNativeAudioElementsSeen > 0 || implementation.nativeAudioPlayBlocks > 0) {
      notes.push("Native <audio> usage was observed. Audio blocking pauses or blocks audio element playback.");
    }
    if (implementation.webAudioEvents > 0) {
      notes.push("Web Audio API activity was observed. Audio blocking targets AudioContext resume/decode/source/destination paths.");
    }
    if (implementation.audioFetchEvents > 0 || implementation.audioXhrEvents > 0) {
      notes.push("Audio-like fetch/XHR requests were observed. Audio blocking may abort matching audio file requests.");
    }
    if (implementation.imageBlockEvents > 0 || implementation.cssBackgroundBlockEvents > 0) {
      notes.push("Image/GIF/WebP-family block events were observed.");
    }
    if (implementation.nativeVideoMuteActions >= 5) {
      notes.push("Video audio was muted repeatedly. The page may be trying to unmute or replace its video element.");
    }
    if (implementation.nativeVideoMuteActionsWithVolume > 0) {
      notes.push("Some video mute entries still had non-zero volume. Current builds should force volume to 0 as well as muted=true.");
    }
    if (implementation.videoUnmuteBlocks > 0 || implementation.videoVolumeBlocks > 0) {
      notes.push("The page tried to restore native video audio; MotionBlock blocked unmute or volume changes in the page context.");
    }
    if (countEvent(eventCounts, "pageAudio.media.videoMutedBeforePlay") > 0) {
      notes.push("This capture includes page-probe video muting before play; current builds should leave video play calls alone and mute from the content layer.");
    }
    if (audioBlocking && !hasObservedAudioPath(implementation)) {
      notes.push("Audio blocking is enabled, but no native audio/video, Web Audio, or audio fetch path was observed. Reload the tab and reproduce the issue before copying the log.");
    }

    Object.keys(featureMatrix).forEach(function (key) {
      const item = featureMatrix[key];
      if (item.enabled && item.blockedCount === 0 && item.evidenceEvents.length === 0) {
        notes.push(key + " is enabled, but this capture has no block evidence for that feature.");
      }
    });
    return notes;
  }

  function buildFeatureMatrix(effective, tabStats, eventCounts) {
    const features = (effective && effective.features) || {};
    const counts = (tabStats && tabStats.byFeature) || {};
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

  function summarizeRecentSignificantEvents(entries) {
    return entries
      .map(function (entry, index) {
        return Object.assign({ index }, entry);
      })
      .filter(function (entry) {
        return /^(settings\.applied|media\.|image\.|pageAudio\.|pagehide)/.test(entry.event || "");
      })
      .slice(-20)
      .map(function (entry) {
        return {
          event: entry.event,
          frameHost: entry.frameHost || "",
          index: entry.index,
          summary: summarizeEntryDetails(entry.details),
          time: entry.time
        };
      });
  }

  function summarizeEntryDetails(details) {
    const source = details && typeof details === "object" ? details : {};
    return {
      action: source.action || "",
      feature: source.feature || "",
      reason: source.reason && source.reason.label ? source.reason.label : source.reason || source.mediaReason || "",
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

  function normalizeEntries(diagnostics) {
    return diagnostics && Array.isArray(diagnostics.entries) ? diagnostics.entries : [];
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

  function hasObservedAudioPath(implementation) {
    return Boolean(
      implementation.maxNativeAudioElementsSeen ||
        implementation.maxNativeVideoElementsSeen ||
        implementation.nativeAudioPlayBlocks ||
        implementation.nativeVideoAudioEnforcements ||
        implementation.videoUnmuteBlocks ||
        implementation.videoVolumeBlocks ||
        implementation.webAudioEvents ||
        implementation.audioFetchEvents ||
        implementation.audioXhrEvents
    );
  }

  root.MotionBlockDiagnosticsAnalysis = {
    buildDiagnosticsAnalysis
  };
})(globalThis);
