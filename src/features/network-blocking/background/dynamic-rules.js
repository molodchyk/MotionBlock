(function (root) {
  "use strict";

  const DNR_FEATURE_RULES = {
    gifv: [
      {
        regexFilter: "\\.gifv(?:$|[?#])",
        resourceTypes: ["image", "media", "xmlhttprequest", "other"]
      }
    ],
    animatedWebp: [
      {
        regexFilter: "\\.webp(?:$|[?#])",
        resourceTypes: ["image"]
      },
      {
        regexFilter: "^data:image/webp",
        resourceTypes: ["image"]
      }
    ],
    video: [
      {
        resourceTypes: ["media"]
      },
      {
        regexFilter: "\\.(?:mp4|m4v|webm|mov|m3u8|mpd)(?:$|[?#])",
        resourceTypes: ["media", "xmlhttprequest"]
      }
    ],
    audio: [
      {
        regexFilter: "\\.(?:mp3|m4a|aac|ogg|oga|wav|flac)(?:$|[?#])",
        resourceTypes: ["media", "xmlhttprequest", "other"]
      }
    ]
  };

  function buildDynamicRules(settings, options) {
    const rules = [];
    let id = Number(options && options.ruleIdStart) || 1;
    const siteRules = settings && settings.siteRules ? settings.siteRules : {};

    Object.keys(DNR_FEATURE_RULES).forEach(function (featureKey) {
      const globalValue = Boolean(settings && settings.features && settings.features[featureKey]);
      const disabledHosts = getDisabledHosts(siteRules);
      const featureOffHosts = getHostsWithFeatureOverride(siteRules, featureKey, false);
      const featureOnHosts = getHostsWithFeatureOverride(siteRules, featureKey, true).filter(function (host) {
        return disabledHosts.indexOf(host) === -1;
      });

      if (globalValue) {
        DNR_FEATURE_RULES[featureKey].forEach(function (template) {
          const condition = cloneCondition(template);
          const excludedHosts = unique(disabledHosts.concat(featureOffHosts)).filter(isDnrDomain);

          if (excludedHosts.length) {
            condition.excludedInitiatorDomains = excludedHosts;
          }

          rules.push(createBlockRule(id, condition));
          id += 1;
        });
        return;
      }

      if (featureOnHosts.length) {
        DNR_FEATURE_RULES[featureKey].forEach(function (template) {
          const condition = cloneCondition(template);
          condition.initiatorDomains = unique(featureOnHosts).filter(isDnrDomain);

          if (condition.initiatorDomains.length) {
            rules.push(createBlockRule(id, condition));
            id += 1;
          }
        });
      }
    });

    return rules;
  }

  function buildTemporaryAllowRules(urls, resourceTypes, options) {
    const ruleIdStart = Number(options && options.ruleIdStart) || 1;
    const ruleIdEnd = Number(options && options.ruleIdEnd) || ruleIdStart;
    const normalizedResourceTypes = Array.isArray(resourceTypes)
      ? resourceTypes.filter(function (resourceType) {
          return typeof resourceType === "string";
        })
      : [];

    return unique(Array.isArray(urls) ? urls : [])
      .filter(function (url) {
        return /^https?:\/\//i.test(url) || /^file:\/\//i.test(url);
      })
      .filter(function (url) {
        return url.length < 1800;
      })
      .slice(0, ruleIdEnd - ruleIdStart + 1)
      .map(function (url, index) {
        return {
          id: ruleIdStart + index,
          priority: 10,
          action: { type: "allow" },
          condition: {
            regexFilter: "^" + escapeRegex(url) + "$",
            isUrlFilterCaseSensitive: false,
            resourceTypes: normalizedResourceTypes.length ? normalizedResourceTypes : ["image", "media", "xmlhttprequest"]
          }
        };
      });
  }

  function getRuleIdsInRange(rules, firstId, lastId) {
    return (Array.isArray(rules) ? rules : [])
      .map(function (rule) {
        return rule.id;
      })
      .filter(function (id) {
        return id >= firstId && id <= lastId;
      });
  }

  function createBlockRule(id, condition) {
    return {
      id,
      priority: 1,
      action: { type: "block" },
      condition
    };
  }

  function cloneCondition(template) {
    const condition = {
      resourceTypes: template.resourceTypes.slice()
    };

    if (template.regexFilter) {
      condition.regexFilter = template.regexFilter;
      condition.isUrlFilterCaseSensitive = false;
    }

    return condition;
  }

  function getDisabledHosts(siteRules) {
    return Object.keys(siteRules).filter(function (host) {
      return siteRules[host].enabled === false;
    });
  }

  function getHostsWithFeatureOverride(siteRules, featureKey, value) {
    return Object.keys(siteRules).filter(function (host) {
      const rule = siteRules[host];
      return rule.enabled !== false && rule.features && rule.features[featureKey] === value;
    });
  }

  function isDnrDomain(host) {
    return /^[a-z0-9.-]+$/i.test(host) && host.indexOf("..") === -1;
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  root.MotionBlockNetworkRules = {
    buildDynamicRules,
    buildTemporaryAllowRules,
    getRuleIdsInRange
  };
})(globalThis);
