// ==UserScript==
// @name         GitHub 时间 Tooltip ISO 8601
// @namespace    my-violentmonkey-scripts
// @version      0.1.0
// @description  将 GitHub 页面时间元素 tooltip 中的日期时间改为 ISO 8601 格式。
// @author       jasonz3157
// @match        https://github.com/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        none
// @run-at       document-start
// @license      GPL-3.0
// ==/UserScript==

(function () {
  'use strict';

  const TIME_ELEMENT_SELECTOR = [
    'relative-time[datetime]',
    'time-ago[datetime]',
    'local-time[datetime]',
    'time[datetime]',
    '[datetime][title]',
    '[datetime][aria-label]',
  ].join(',');

  const TOOLTIP_ATTRS = [
    'title',
    'aria-label',
    'data-original-title',
    'data-tooltip-content',
  ];

  const FALLBACK_TOOLTIP_SELECTOR = TOOLTIP_ATTRS.map((attrName) => `[${attrName}]`).join(',');

  const GITHUB_TIME_TEXT_PATTERN =
    /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}, \d{1,2}:\d{2}(?::\d{2})? [AP]M GMT[+-]\d{1,2}(?::?\d{2})?$/i;

  let scanTimer = 0;

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function pad3(value) {
    return String(value).padStart(3, '0');
  }

  function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
  }

  function parseDateTime(value) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }

  function parseGitHubTooltip(value) {
    if (!value || !GITHUB_TIME_TEXT_PATTERN.test(value.trim())) {
      return null;
    }

    return parseDateTime(value);
  }

  function getDateFromElement(element) {
    const datetime = element.getAttribute('datetime');
    const dateFromDatetime = parseDateTime(datetime);

    if (dateFromDatetime) {
      return dateFromDatetime;
    }

    for (const attrName of TOOLTIP_ATTRS) {
      const dateFromTooltip = parseGitHubTooltip(element.getAttribute(attrName));

      if (dateFromTooltip) {
        return dateFromTooltip;
      }
    }

    return null;
  }

  function formatLocalIso8601(date) {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    const hour = pad2(date.getHours());
    const minute = pad2(date.getMinutes());
    const second = pad2(date.getSeconds());
    const millisecond = date.getMilliseconds();
    const offsetMinutes = -date.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const absOffsetMinutes = Math.abs(offsetMinutes);
    const offsetHour = pad2(Math.floor(absOffsetMinutes / 60));
    const offsetMinute = pad2(absOffsetMinutes % 60);
    const millisecondsPart = millisecond === 0 ? '' : `.${pad3(millisecond)}`;

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${millisecondsPart}${offsetSign}${offsetHour}:${offsetMinute}`;
  }

  function setAttrIfChanged(element, attrName, value) {
    if (element.getAttribute(attrName) !== value) {
      element.setAttribute(attrName, value);
    }
  }

  function updateTooltip(element) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const date = getDateFromElement(element);

    if (!date) {
      return;
    }

    const isoDateTime = formatLocalIso8601(date);

    // GitHub 的原生 title tooltip 是主要目标；其他属性只在原本存在时同步改写。
    setAttrIfChanged(element, 'title', isoDateTime);

    for (const attrName of TOOLTIP_ATTRS) {
      if (attrName !== 'title' && element.hasAttribute(attrName)) {
        setAttrIfChanged(element, attrName, isoDateTime);
      }
    }
  }

  function updateTooltipFromTarget(target) {
    if (!(target instanceof Element)) {
      return;
    }

    updateTooltip(target);

    const closestTimeElement = target.closest(TIME_ELEMENT_SELECTOR);
    const closestTooltipElement = target.closest(FALLBACK_TOOLTIP_SELECTOR);

    if (closestTimeElement && closestTimeElement !== target) {
      updateTooltip(closestTimeElement);
    }

    if (closestTooltipElement && closestTooltipElement !== target && closestTooltipElement !== closestTimeElement) {
      updateTooltip(closestTooltipElement);
    }
  }

  function scanFallbackTitleElements(root) {
    const elements = root.querySelectorAll(FALLBACK_TOOLTIP_SELECTOR);

    for (const element of elements) {
      updateTooltip(element);
    }
  }

  function scanTimeElements(root) {
    const elements = root.querySelectorAll(TIME_ELEMENT_SELECTOR);

    for (const element of elements) {
      updateTooltip(element);
    }
  }

  function scan(root = document) {
    if (!(root instanceof Document || root instanceof DocumentFragment || root instanceof Element)) {
      return;
    }

    if (root instanceof Element) {
      updateTooltip(root);
    }

    scanTimeElements(root);
    scanFallbackTitleElements(root);
  }

  function scheduleScan() {
    if (scanTimer) {
      return;
    }

    scanTimer = window.setTimeout(() => {
      scanTimer = 0;
      scan();
    }, 50);
  }

  function handleMutations(mutations) {
    let needsFullScan = false;

    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        updateTooltip(mutation.target);
        continue;
      }

      if (mutation.addedNodes.length > 0) {
        needsFullScan = true;
      }
    }

    if (needsFullScan) {
      scheduleScan();
    }
  }

  function startObserver() {
    const observer = new MutationObserver(handleMutations);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['datetime', ...TOOLTIP_ATTRS],
      childList: true,
      subtree: true,
    });
  }

  function init() {
    scan();
    startObserver();

    document.addEventListener('mouseover', (event) => updateTooltipFromTarget(event.target), true);
    document.addEventListener('focusin', (event) => updateTooltipFromTarget(event.target), true);
    document.addEventListener('turbo:load', scheduleScan);
    document.addEventListener('turbo:render', scheduleScan);
    document.addEventListener('pjax:end', scheduleScan);
  }

  if (document.documentElement) {
    init();
  } else {
    document.addEventListener('readystatechange', init, { once: true });
  }
})();
