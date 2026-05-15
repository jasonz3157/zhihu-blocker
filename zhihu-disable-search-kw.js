// ==UserScript==
// @name         zhihu-disable-search-kw
// @namespace    https://zhihu.com/
// @version      1.0.2
// @description  将知乎正文中的搜索高亮词和 SVG 图标还原为普通文本
// @match        *://*.zhihu.com/*
// @run-at       document-idle
// @grant        none
// @icon         https://static.zhihu.com/heifetz/favicon.ico
// @downloadURL  https://raw.githubusercontent.com/jasonz3157/my-violentmonkey-scripts/refs/heads/master/zhihu-disable-search-kw.js
// @updateURL    https://raw.githubusercontent.com/jasonz3157/my-violentmonkey-scripts/refs/heads/master/zhihu-disable-search-kw.js

// ==/UserScript==

(function () {
    'use strict';

    const SELECTOR = [
        'a.RichContent-EntityWord',
        'a[href*="zhida.zhihu.com/search"]',
        'a[href*="/search?"][data-paste-text="true"]'
    ].join(',');

    function toPlainText(root = document) {
        const links = [];

        if (root.nodeType === Node.ELEMENT_NODE && root.matches?.(SELECTOR)) {
            links.push(root);
        }

        links.push(...(root.querySelectorAll?.(SELECTOR) || []));
        if (links.length === 0) return;

        links.forEach((link) => {
            // 防止重复处理
            if (!link.parentNode) return;

            // 先移除 SVG，避免未来某些 SVG 带 title/text 影响 textContent
            link.querySelectorAll('svg').forEach(svg => svg.remove());

            const text = link.textContent || '';

            // 用纯文本节点替换整个 a 标签
            const textNode = document.createTextNode(text);
            link.replaceWith(textNode);

            // 顺手去掉外层只包着这段文本的无意义 span
            const parent = textNode.parentNode;
            if (
                parent &&
                parent.nodeType === Node.ELEMENT_NODE &&
                parent.tagName === 'SPAN' &&
                parent.childNodes.length === 1 &&
                parent.parentNode
            ) {
                parent.replaceWith(textNode);
            }
        });
    }

    // 首次处理
    toPlainText();

    function scheduleFullScan() {
        if (scheduleFullScan.timer) return;

        scheduleFullScan.timer = setTimeout(() => {
            scheduleFullScan.timer = null;
            toPlainText();
        }, 300);
    }
    scheduleFullScan.timer = null;

    // 知乎是动态加载页面，需要监听新增内容
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (
                mutation.type === 'attributes' &&
                mutation.target.nodeType === Node.ELEMENT_NODE
            ) {
                toPlainText(mutation.target);
            }

            for (const node of mutation.addedNodes) {
                if (
                    node.nodeType === Node.ELEMENT_NODE ||
                    node.nodeType === Node.DOCUMENT_FRAGMENT_NODE
                ) {
                    toPlainText(node);
                }
            }
        }

        scheduleFullScan();
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'href', 'data-paste-text'],
        childList: true,
        subtree: true
    });
})();
