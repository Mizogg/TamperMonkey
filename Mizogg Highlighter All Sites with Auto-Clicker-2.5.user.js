// ==UserScript==
// @name          Mizogg Highlighter All Sites with Auto-Clicker
// @namespace     https://mizogg.com
// @version       2.5
// @description   Highlights BTC Addresses and Auto-Clicker with Auto-Stop on Match
// @author        mizogg.com
// @match         *://*/*
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// @grant         GM_getValue
// ==/UserScript==

(function () {
    'use strict';
    if (window.self !== window.top) return;

    // Global state
    let keywordRegex = null;
    let highlightStyle = GM_getValue('highlightStyle') || "color:#00f; font-weight:bold; background-color: #0f0;";
    let autoClickerInterval = null;
    let autoClickerActive = GM_getValue('autoClickerState', false);

    // User preferences menu
    function setUserPref(varName, defaultVal, menuText, promtText, sep) {
        GM_registerMenuCommand(menuText, function () {
            let val = prompt(promtText, GM_getValue(varName, defaultVal));
            if (val === null) return;
            if (sep && val) {
                const pat1 = new RegExp('\\s*' + sep + '+\\s*', 'g');
                const pat2 = new RegExp('(?:^' + sep + '+|' + sep + '+$)', 'g');
                val = val.replace(pat1, sep).replace(pat2, '');
            }
            val = val.replace(/\s{2,}/g, ' ').trim();
            if (val.split(sep).length > 300) alert("Too many keywords may slow down the script.");
            GM_setValue(varName, val);

            if (varName === 'clickInterval') {
                startAutoClicker(Number(val));
            } else {
                updateHighlightSettings();
                highlightMatches(document.body);
            }
        });
    }

    setUserPref('keywords', 'word 1,word 2,word 3', 'Set Keywords',
        'Set keywords separated by comma\r\nExample:\r\nword 1,word 2,word 3', ',');
    setUserPref('highlightStyle', highlightStyle, 'Set Highlight Style',
        'Set the Highlight Style (CSS)\r\nExample:\r\ncolor: #f00; font-weight: bold; background-color: #ffe4b5;');
    setUserPref('showAlert', 'true', 'Toggle Alert for Found Keywords',
        'Show alert when keywords are found? (true/false)');
    setUserPref('clickInterval', '1000', 'Set Auto-Clicker Interval (ms)',
        'Set auto-click interval in milliseconds (e.g., 1000)');

    function updateHighlightSettings() {
        const keywords = GM_getValue('keywords');
        highlightStyle = GM_getValue('highlightStyle') || highlightStyle;
        if (!keywords) return;

        const rQuantifiers = /[-\/\\^$*+?.()|[\]{}]/g;
        const pattern = keywords.split(',')
            .map(k => k.trim().replace(rQuantifiers, '\\$&'))
            .filter(k => k.length > 0)
            .join('|');

        keywordRegex = pattern ? new RegExp('(' + pattern + ')', 'gi') : null;
    }

    updateHighlightSettings();

    // Mouse position tracker
    let currentMousePos = { x: -1, y: -1 };
    document.addEventListener('mousemove', e => {
        currentMousePos.x = e.pageX;
        currentMousePos.y = e.pageY;
    });

    // Auto-clicker logic
    function toggleAutoClicker() {
        autoClickerActive = !autoClickerActive;
        GM_setValue('autoClickerState', autoClickerActive);
        updateToggleButton();
        if (autoClickerActive) {
            const clickInterval = Number(GM_getValue('clickInterval', 1000));
            startAutoClicker(clickInterval);
        } else if (autoClickerInterval) {
            clearInterval(autoClickerInterval);
        }
    }

    function startAutoClicker(interval) {
        if (autoClickerInterval) clearInterval(autoClickerInterval);
        autoClickerInterval = setInterval(() => {
            if (autoClickerActive && currentMousePos.x > -1 && currentMousePos.y > -1) {
                const el = document.elementFromPoint(currentMousePos.x, currentMousePos.y);
                if (el) {
                    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
            }
        }, interval);
    }

    if (autoClickerActive) {
        startAutoClicker(Number(GM_getValue('clickInterval', 1000)));
    }

    // Keyboard shortcut
    document.addEventListener('keydown', function (e) {
        if (e.altKey && e.key.toLowerCase() === 'a') {
            toggleAutoClicker();
            alert(`Auto-clicker is now ${autoClickerActive ? 'ON' : 'OFF'}`);
        }
    });

    // Highlighting function
    function highlightMatches(el) {
        if (!keywordRegex) return;

        const snapElements = document.evaluate(
            './/text()[normalize-space() != "" ' +
            'and not(ancestor::style) and not(ancestor::script) and not(ancestor::textarea)' +
            'and not(ancestor::code) and not(ancestor::pre)]',
            el, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null
        );

        const foundKeywords = [];

        for (let i = 0, len = snapElements.snapshotLength; i < len; i++) {
            const node = snapElements.snapshotItem(i);
            if (keywordRegex.test(node.nodeValue) && !node.parentElement?.dataset?.mizogg) {
                const wrapper = document.createElement('span');
                wrapper.innerHTML = node.nodeValue.replace(keywordRegex, function (match) {
                    foundKeywords.push(match);
                    return `<span style="${highlightStyle}" class="mizogg-highlight" data-mizogg="1">${match}</span>`;
                });
                node.parentNode.replaceChild(wrapper, node);
            }
        }

        if (foundKeywords.length > 0) {
            if (autoClickerActive) {
                toggleAutoClicker();
                alert("NICE ONE BITCOINS FOUND! Auto-clicker turned OFF.\n\n" + foundKeywords.join(", "));
            } else if (GM_getValue('showAlert') === 'true') {
                alert("NICE ONE BITCOINS FOUND!\n\n" + foundKeywords.join(", "));
            }
        }
    }

    // Mutation Observer for dynamic content
    const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
    if (MutationObserver) {
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(mutation => {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    if (mutation.addedNodes[i].nodeType === 1) {
                        highlightMatches(mutation.addedNodes[i]);
                    }
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Toggle button
    function createToggleButton() {
        const btn = document.createElement('button');
        btn.id = 'mizogg-toggle-btn';
        btn.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 99999;
            padding: 8px 12px;
            font-size: 14px;
            border: none;
            border-radius: 8px;
            background-color: #222;
            color: #fff;
            cursor: pointer;
            box-shadow: 0 0 5px rgba(0,0,0,0.5);
        `;
        btn.textContent = autoClickerActive ? '🟢 Clicker ON' : '⚪ Clicker OFF';
        btn.addEventListener('click', toggleAutoClicker);
        document.body.appendChild(btn);
    }

    function updateToggleButton() {
        const btn = document.getElementById('mizogg-toggle-btn');
        if (btn) {
            btn.textContent = autoClickerActive ? '🟢 Clicker ON' : '⚪ Clicker OFF';
        }
    }

    // Start
    createToggleButton();
    highlightMatches(document.body);
})();
