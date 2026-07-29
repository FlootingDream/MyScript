// ==UserScript==
// @name         强制在新标签页打开链接
// @namespace    http://tampermonkey.net/
// @license MIT
// @version      2.2.0
// @description  强制链接新标签打开，通用规则和网站规则均可配置忽略容器，支持配置导入导出
// @author       腾讯元宝
// @match        *://*/*
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @grant       GM_addStyle
// @run-at      document-start
// @noframes
// @downloadURL https://update.greasyfork.org/scripts/588665/%E5%BC%BA%E5%88%B6%E5%9C%A8%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5%E6%89%93%E5%BC%80%E9%93%BE%E6%8E%A5.user.js
// @updateURL https://update.greasyfork.org/scripts/588665/%E5%BC%BA%E5%88%B6%E5%9C%A8%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5%E6%89%93%E5%BC%80%E9%93%BE%E6%8E%A5.meta.js
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'lnf_config_v2';

    // ==================== 数据层 ====================

    function loadConfig() {
        let config = null;
        try {
            config = JSON.parse(GM_getValue(STORAGE_KEY, 'null'));
        } catch (e) { }

        const defaults = {
            enabled: true,
            rules: [
                {
                    id: '__global__',
                    name: '通用规则',
                    patterns: [],
                    ignoredContainers: [],
                    enabled: true,
                    isGlobal: true
                }
            ]
        };

        if (!config) config = JSON.parse(JSON.stringify(defaults));

        if (!config.rules.find(r => r.id === '__global__')) {
            config.rules.unshift(JSON.parse(JSON.stringify(defaults.rules[0])));
        }

        config.rules.forEach(r => {
            if (!Array.isArray(r.ignoredContainers)) r.ignoredContainers = [];
            if (r.enabled === undefined) r.enabled = true;
            if (r.useGlobal === undefined && !r.isGlobal) r.useGlobal = true;
        });

        return config;
    }

    function saveConfig(config) {
        GM_setValue(STORAGE_KEY, JSON.stringify(config));
    }

    // ==================== 导入导出 ====================

    function exportConfig() {
        const config = loadConfig();
        const dataStr = JSON.stringify(config, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'lnf-config-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importConfig(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);

                // 校验基本结构
                if (!imported || typeof imported !== 'object') {
                    alert('导入失败：配置文件格式不正确');
                    return;
                }
                if (!Array.isArray(imported.rules)) {
                    alert('导入失败：缺少 rules 字段');
                    return;
                }

                // 确保通用规则存在且正确
                if (!imported.rules.find(r => r.id === '__global__')) {
                    imported.rules.unshift({
                        id: '__global__',
                        name: '通用规则',
                        patterns: [],
                        ignoredContainers: [],
                        enabled: true,
                        isGlobal: true
                    });
                }

                // 字段兼容处理
                imported.rules.forEach(r => {
                    if (!Array.isArray(r.ignoredContainers)) r.ignoredContainers = [];
                    if (!Array.isArray(r.patterns)) r.patterns = [];
                    if (r.enabled === undefined) r.enabled = true;
                    if (r.useGlobal === undefined && !r.isGlobal) r.useGlobal = true;
                });

                if (imported.enabled === undefined) imported.enabled = true;

                saveConfig(imported);

                // 刷新面板
                const root = document.getElementById('lnf-root');
                if (root) {
                    const config = loadConfig();
                    renderSidebar(root, config);
                    selectRule(root, '__global__', config);
                }

                processLinks();
                alert('导入成功！共 ' + imported.rules.length + ' 条规则');
            } catch (err) {
                alert('导入失败：' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // ==================== 匹配逻辑 ====================

    function testPattern(pattern, host) {
        pattern = (pattern || '').trim();
        if (!pattern) return false;
        if (!/[/\\^$*+?.()|[\]{}]/.test(pattern)) {
            const p = pattern.replace(/^\*\./, '.');
            return host === p || host.endsWith('.' + p.replace(/^\./, ''));
        }
        try {
            return new RegExp(pattern).test(host) || new RegExp(pattern).test(location.href);
        } catch (e) {
            return false;
        }
    }

    function matchCurrentSite(rules) {
        const host = location.hostname;
        for (const rule of rules) {
            if (rule.isGlobal) continue;
            if (!rule.enabled) continue;
            for (const p of rule.patterns || []) {
                if (testPattern(p, host)) return rule;
            }
        }
        return null;
    }

    function getEffectiveIgnoredSelectors(config) {
        const set = new Set();
        const siteRule = matchCurrentSite(config.rules);

        const globalRule = config.rules.find(r => r.id === '__global__');
        if (globalRule && globalRule.enabled) {
            (globalRule.ignoredContainers || []).forEach(s => set.add(s.trim()));
        }

        if (siteRule) {
            (siteRule.ignoredContainers || []).forEach(s => set.add(s.trim()));
        }

        return [...set].filter(Boolean);
    }

    function isInIgnoredContainer(el, selectors) {
        if (!el || selectors.length === 0) return false;
        const sel = selectors.join(', ');
        try {
            return el.closest(sel) !== null;
        } catch (e) {
            return false;
        }
    }

    // ==================== 核心：劫持 window.open ====================
    let _lnf_lastClickedA = null;
    let _lnf_lastNewTab = 0;

    const _originalOpen = window.open;
    window.open = function () {
        const config = loadConfig();
        if (!config.enabled) return _originalOpen.apply(this, arguments);

        const ignoredSelectors = getEffectiveIgnoredSelectors(config);
        const activeEl = document.activeElement;

        const srcA = (activeEl && activeEl.tagName === 'A' && activeEl.href)
            ? activeEl
            : _lnf_lastClickedA;

        if (srcA && srcA.href) {
            if (isInIgnoredContainer(srcA, ignoredSelectors)) {
                window.location.href = srcA.href;
                return window;
            }
        }

        const siteRule = matchCurrentSite(config.rules);
        const globalRule = config.rules.find(r => r.id === '__global__');
        const shouldForce = (globalRule && globalRule.enabled) ||
            (siteRule && siteRule.useGlobal && globalRule && globalRule.enabled);

        if (shouldForce) {
            return _originalOpen.apply(this, arguments);
        }

        return _originalOpen.apply(this, arguments);
    };

    // ==================== 点击拦截 ====================
    function interceptClicks() {
        document.addEventListener('click', function (e) {
            if (e.defaultPrevented) return;
            const a = e.target.closest('a');
            if (!a || !a.href) return;
            _lnf_lastClickedA = a;  
            if (!a.href.startsWith('http://') && !a.href.startsWith('https://')) return;

            // 尊重修饰键：Ctrl/Shift/Cmd+点击 交给浏览器原生（通常就是新标签）
            if (e.ctrlKey || e.shiftKey || e.metaKey) return;

            const config = loadConfig();
            if (!config.enabled) return;

            const ignoredSelectors = getEffectiveIgnoredSelectors(config);

            // —— 忽略容器：当前页打开 ——
            if (isInIgnoredContainer(a, ignoredSelectors)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                setTimeout(() => { window.location.href = a.href; }, 0);
                return false;
            }

            // —— 判断是否该强制新标签 ——
            const siteRule = matchCurrentSite(config.rules);
            const globalRule = config.rules.find(r => r.id === '__global__');
            const shouldForce = (globalModeOn(config, siteRule, globalRule));

            if (!shouldForce) return;

            // 关键：同源 SPA 路径（同 origin，不同 path）GitHub 会用 pushState 路由
            // 我们必须阻止 React 的默认处理，自己开新标签
            let url;
            try { url = new URL(a.href); } catch (_) { return; }
            const sameOrigin = url.origin === location.origin;
            const isSamePageAnchor = sameOrigin &&
                url.pathname === location.pathname &&
                url.search === location.search;

            if (sameOrigin && !isSamePageAnchor) {
                // GitHub Issues 议题链接走这里
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                // 用临时 a 标签 click，确保是"用户手势"内的 window.open，不被拦截
                const tmp = document.createElement('a');
                tmp.href = a.href;
                tmp.target = '_blank';
                tmp.rel = 'noopener noreferrer';
                document.body.appendChild(tmp);

                _lnf_lastNewTab = Date.now();

                tmp.click();
                tmp.remove();
                return false;
            }
        }, true);
    }

    function globalModeOn(config, siteRule, globalRule) {
        if (globalRule && globalRule.enabled) return true;
        if (siteRule && siteRule.enabled && siteRule.useGlobal) return true;
        if (siteRule && siteRule.enabled && !siteRule.useGlobal) return false;
        return false;
    }

    // ==================== 处理已有链接 ====================

    function processLinks() {
        const config = loadConfig();
        if (!config.enabled) return;

        const ignoredSelectors = getEffectiveIgnoredSelectors(config);
        const siteRule = matchCurrentSite(config.rules);
        const globalRule = config.rules.find(r => r.id === '__global__');
        const shouldForce = (globalRule && globalRule.enabled) ||
            (siteRule && siteRule.useGlobal);

        document.querySelectorAll('a[href]').forEach(a => {
            if (!a.href.startsWith('http://') && !a.href.startsWith('https://')) return;

            if (isInIgnoredContainer(a, ignoredSelectors)) {
                a.removeAttribute('target');
                a.removeAttribute('rel');
                return;
            }

            if (shouldForce) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            }
        });
    }

    function observeLinks() {
        const observer = new MutationObserver(() => {
            clearTimeout(observeLinks._timer);
            observeLinks._timer = setTimeout(processLinks, 200);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // ==================== UI ====================

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function closeAllPanels() {
        document.getElementById('lnf-root')?.remove();
    }

    function openPanel() {
        closeAllPanels();
        const config = loadConfig();

        const root = document.createElement('div');
        root.id = 'lnf-root';
        root.innerHTML = `
            <div class="lnf-mask">
                <div class="lnf-panel">
                    <div class="lnf-header">
                        <span>配置面板</span>
                        <div class="lnf-header-actions">
                            <button class="lnf-import-btn" id="lnf-import">📥 导入</button>
                            <button class="lnf-export-btn" id="lnf-export">📤 导出</button>
                            <button class="lnf-x">×</button>
                        </div>
                    </div>
                    <div class="lnf-body">
                        <div class="lnf-sidebar">
                            <input class="lnf-search" placeholder="搜索..." />
                            <div class="lnf-list"></div>
                            <button class="lnf-add-btn">+ 新增规则</button>
                        </div>
                        <div class="lnf-main">
                            <div class="lnf-main-header">
                                <span class="lnf-title"></span>
                                <span class="lnf-sub"></span>
                            </div>
                            <div class="lnf-content"></div>
                            <div class="lnf-bottom-bar" id="lnf-bottom-bar"></div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 隐藏的文件输入 -->
            <input type="file" id="lnf-file-input" accept=".json,application/json" style="display:none" />
        `;

        document.documentElement.appendChild(root);

        renderSidebar(root, config);
        selectRule(root, '__global__', config);

        // 绑定事件
        root.querySelector('.lnf-x').onclick = closeAllPanels;
        root.querySelector('.lnf-add-btn').onclick = () => openAddRule(root);
        root.querySelector('.lnf-search').oninput = e => {
            const kw = e.target.value.toLowerCase();
            root.querySelectorAll('.lnf-item').forEach(el => {
                el.style.display = !kw || el.textContent.toLowerCase().includes(kw) ? '' : 'none';
            });
        };

        // 导出
        root.querySelector('#lnf-export').onclick = exportConfig;

        // 导入
        const fileInput = root.querySelector('#lnf-file-input');
        root.querySelector('#lnf-import').onclick = () => {
            fileInput.click();
        };
        fileInput.onchange = () => {
            const file = fileInput.files[0];
            if (!file) return;
            importConfig(file);
            fileInput.value = ''; // 重置，允许重复导入同一文件
        };
    }

    function renderSidebar(root, config) {
        const list = root.querySelector('.lnf-list');
        list.innerHTML = '';

        config.rules.forEach(rule => {
            const div = document.createElement('div');
            div.className = 'lnf-item';
            div.dataset.id = rule.id;
            div.textContent = rule.name;
            div.onclick = () => selectRule(root, rule.id, config);
            list.appendChild(div);
        });
    }

    function selectRule(root, ruleId, config) {
        root.querySelectorAll('.lnf-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === ruleId);
        });

        const rule = config.rules.find(r => r.id === ruleId);
        if (!rule) return;

        const title = root.querySelector('.lnf-title');
        const sub = root.querySelector('.lnf-sub');
        const content = root.querySelector('.lnf-content');
        const bottomBar = root.querySelector('#lnf-bottom-bar');

        title.textContent = rule.name;
        sub.textContent = rule.isGlobal ? '' : `匹配：${(rule.patterns || []).join(', ') || '无'}`;

        if (rule.isGlobal) {
            // ===== 通用规则视图 =====
            content.innerHTML = `
                <div class="lnf-section">
                    <label class="lnf-switch">
                        <input type="checkbox" id="g-enabled" ${rule.enabled ? 'checked' : ''} />
                        <span>启用配置</span>
                    </label>
                    <p class="lnf-hint">开启后，所有网站默认强制新标签打开。可在下方添加忽略容器，使特定区域内的链接保持当前页打开。</p>
                </div>
                <div class="lnf-section">
                    <h3>忽略容器</h3>
                    <p class="lnf-hint">在这些容器内的链接不会强制新标签，会保持当前页打开。</p>
                    <div class="lnf-row">
                        <input id="ig-input" placeholder='CSS选择器，如 #sidebar / .nav / [data-no-newtab]' />
                        <button id="ig-add">添加</button>
                    </div>
                    <div class="lnf-tags"></div>
                </div>
            `;

            content.querySelector('#g-enabled').onchange = e => {
                rule.enabled = e.target.checked;
                saveConfig(config);
                processLinks();
            };

            bottomBar.innerHTML = '';

        } else {
            // ===== 网站规则视图 =====
            content.innerHTML = `
                <div class="lnf-section">
                    <h3>匹配地址</h3>
                    <textarea id="r-patterns" rows="3" cols="50" placeholder="每行一个，支持域名或正则">${(rule.patterns || []).join('\n')}</textarea>
                    <button id="r-save-patterns">保存匹配地址</button>
                </div>
                <div class="lnf-section">
                    <h3>本规则忽略容器</h3>
                    <p class="lnf-hint">这些容器内的链接不受新标签约束（当前页打开）。</p>
                    <div class="lnf-row">
                        <input id="ig-input" placeholder='CSS选择器' />
                        <button id="ig-add">添加</button>
                    </div>
                    <div class="lnf-tags"></div>
                </div>
            `;

            content.querySelector('#r-save-patterns').onclick = () => {
                const val = content.querySelector('#r-patterns').value;
                rule.patterns = val.split('\n').map(s => s.trim()).filter(Boolean);
                saveConfig(config);
                selectRule(root, ruleId, config);
                renderSidebar(root, config);
                processLinks();
            };

            // ===== 底部栏 =====
            bottomBar.innerHTML = `
                <label class="lnf-bottom-switch">
                    <input type="checkbox" id="r-enabled" ${rule.enabled ? 'checked' : ''} />
                    <span>启用此规则</span>
                </label>
                <label class="lnf-bottom-switch">
                    <input type="checkbox" id="r-use-global" ${rule.useGlobal ? 'checked' : ''} />
                    <span>启用通用规则</span>
                </label>
                <button id="r-delete" class="lnf-danger">删除此规则</button>
            `;

            bottomBar.querySelector('#r-enabled').onchange = e => {
                rule.enabled = e.target.checked;
                saveConfig(config);
                processLinks();
            };
            bottomBar.querySelector('#r-use-global').onchange = e => {
                rule.useGlobal = e.target.checked;
                saveConfig(config);
                processLinks();
            };
            bottomBar.querySelector('#r-delete').onclick = () => {
                if (!confirm('确定删除此规则？')) return;
                config.rules = config.rules.filter(r => r.id !== ruleId);
                saveConfig(config);
                selectRule(root, '__global__', config);
                renderSidebar(root, config);
            };
        }

        renderIgnoredTags(content, rule, config, () => {
            saveConfig(config);
            selectRule(root, ruleId, config);
            processLinks();
        });
    }

    function renderIgnoredTags(content, rule, config, onChange) {
        const tagsEl = content.querySelector('.lnf-tags');
        if (!tagsEl) return;

        tagsEl.innerHTML = '';
        (rule.ignoredContainers || []).forEach(sel => {
            const tag = document.createElement('span');
            tag.className = 'lnf-tag';
            tag.innerHTML = `${escapeHtml(sel)} <button data-sel="${escapeHtml(sel)}">×</button>`;
            tagsEl.appendChild(tag);
        });

        tagsEl.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                const sel = btn.dataset.sel;
                rule.ignoredContainers = rule.ignoredContainers.filter(s => s !== sel);
                onChange();
            };
        });

        const addBtn = content.querySelector('#ig-add');
        const input = content.querySelector('#ig-input');
        if (addBtn && input) {
            addBtn.onclick = () => {
                const val = input.value.trim();
                if (!val) return;
                if (!rule.ignoredContainers) rule.ignoredContainers = [];
                if (!rule.ignoredContainers.includes(val)) {
                    rule.ignoredContainers.push(val);
                    onChange();
                }
            };
            input.onkeydown = e => {
                if (e.key === 'Enter') addBtn.click();
            };
        }
    }

    function openAddRule(root) {
        const overlay = document.createElement('div');
        overlay.className = 'lnf-mask';
        overlay.innerHTML = `
            <div class="lnf-add-panel">
                <div class="lnf-header">
                    <span>新增规则</span>
                    <button class="lnf-x">×</button>
                </div>
                <div class="lnf-add-body">
                    <label>规则名称</label>
                    <input id="new-name" placeholder="例如：百度" />
                    <label>匹配地址（每行一个，支持域名或正则）</label>
                    baidu.com
.*\\.baidu\\.com"></textarea>
                </div>
                <div class="lnf-add-footer">
                    <button id="add-cancel">取消</button>
                    <button id="add-save">保存</button>
                </div>
            </div>
        `;

        root.appendChild(overlay);

        overlay.querySelector('.lnf-x').onclick = () => overlay.remove();
        overlay.querySelector('#add-cancel').onclick = () => overlay.remove();
        overlay.querySelector('#add-save').onclick = () => {
            const name = overlay.querySelector('#new-name').value.trim() || '未命名规则';
            const patterns = overlay.querySelector('#new-patterns').value
                .split('\n').map(s => s.trim()).filter(Boolean);

            if (!patterns.length) {
                alert('请至少填写一个匹配地址');
                return;
            }

            const config = loadConfig();
            config.rules.push({
                id: 'r_' + Date.now().toString(36),
                name,
                patterns,
                ignoredContainers: [],
                enabled: true,
                useGlobal: true
            });
            saveConfig(config);
            overlay.remove();
            openPanel();
        };
    }

    // ==================== 样式 ====================

    GM_addStyle(`
        .lnf-mask {
            position: fixed; inset: 0; z-index: 2147483647;
            background: rgba(0,0,0,.5);
            display: flex; align-items: center; justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif;
        }
        .lnf-panel {
            background: #fff; border-radius: 8px;
            width: 800px; max-width: 95vw; height: 560px; max-height: 90vh;
            display: flex; flex-direction: column; overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,.3);
        }
        .lnf-add-panel {
            background: #fff; border-radius: 8px;
            width: 460px; max-width: 95vw;
            display: flex; flex-direction: column; overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,.3);
        }
        .lnf-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 16px; border-bottom: 1px solid #e0e0e0;
            font-weight: 600; font-size: 15px;
        }
        .lnf-header-actions {
            display: flex; align-items: center; gap: 8px;
        }
        .lnf-import-btn, .lnf-export-btn {
            padding: 4px 10px; border: 1px solid #ddd; background: #fff;
            border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 400;
            color: #555; transition: all .15s;
        }
        .lnf-import-btn:hover { background: #e8f5e9; border-color: #4caf50; color: #2e7d32; }
        .lnf-export-btn:hover { background: #e3f2fd; border-color: #1565c0; color: #0d47a1; }
        .lnf-x {
            background: none; border: none; font-size: 20px; cursor: pointer;
            width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
            border-radius: 4px;
        }
        .lnf-x:hover { background: #f0f0f0; }
        .lnf-body { display: flex; flex: 1; min-height: 0; }
        .lnf-sidebar {
            width: 220px; border-right: 1px solid #e0e0e0;
            display: flex; flex-direction: column; background: #fafafa;
        }
        .lnf-search {
            margin: 8px; padding: 6px 10px; border: 1px solid #ddd;
            border-radius: 4px; outline: none; font-size: 13px;
        }
        .lnf-list { flex: 1; overflow-y: auto; padding: 4px; }
        .lnf-item {
            padding: 8px 12px; margin: 2px 4px; border-radius: 4px;
            cursor: pointer; font-size: 14px; color: #333;
        }
        .lnf-item:hover { background: #eee; }
        .lnf-item.active { background: #e3f2fd; color: #1565c0; font-weight: 500; }
        .lnf-add-btn {
            margin: 8px; padding: 8px; border: 1px dashed #999;
            background: none; border-radius: 4px; cursor: pointer;
            font-size: 13px; color: #555;
        }
        .lnf-add-btn:hover { border-color: #1565c0; color: #1565c0; }
        .lnf-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .lnf-main-header {
            padding: 12px 16px; border-bottom: 1px solid #e0e0e0;
            display: flex; align-items: baseline; gap: 12px;
        }
        .lnf-title { font-weight: 600; font-size: 15px; }
        .lnf-sub { font-size: 12px; color: #888; }
        .lnf-content { flex: 1; overflow-y: auto; padding: 16px; }
        .lnf-section { margin-bottom: 24px; }
        .lnf-section h3 { font-size: 14px; margin: 0 0 8px; color: #333; }
        .lnf-hint { font-size: 12px; color: #888; margin: 4px 0 8px; }
        .lnf-switch {
            display: flex; align-items: center; gap: 8px;
            margin-bottom: 8px; font-size: 14px; cursor: pointer;
        }
        .lnf-switch input { cursor: pointer; }
        .lnf-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .lnf-row input {
            flex: 1; padding: 6px 10px; border: 1px solid #ddd;
            border-radius: 4px; outline: none; font-size: 13px;
        }
        .lnf-row button, .lnf-add-footer button, #r-save-patterns {
            padding: 6px 14px; border: 1px solid #ddd; background: #fff;
            border-radius: 4px; cursor: pointer; font-size: 13px;
        }
        .lnf-row button:hover, .lnf-add-footer button:hover, #r-save-patterns:hover {
            background: #f5f5f5;
        }
        #add-save { background: #1565c0; color: #fff; border-color: #1565c0; }
        #add-save:hover { background: #0d47a1; }
        .lnf-add-body { padding: 16px; flex: 1; display: flex; flex-direction: column; }
        .lnf-add-body label { font-size: 13px; font-weight: 500; margin: 8px 0 4px; }
        .lnf-add-body input, .lnf-add-body textarea {
            padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px;
            outline: none; font-size: 13px; font-family: inherit;
        }
        .lnf-add-body textarea { flex: 1; resize: none; }
        .lnf-add-footer { padding: 12px 16px; border-top: 1px solid #e0e0e0; text-align: right; }
        .lnf-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .lnf-tag {
            display: inline-flex; align-items: center; gap: 4px;
            background: #e3f2fd; color: #1565c0;
            padding: 4px 8px; border-radius: 4px; font-size: 12px;
        }
        .lnf-tag button {
            background: none; border: none; cursor: pointer; font-size: 14px;
            color: #1565c0; padding: 0; width: 16px; height: 16px;
            display: flex; align-items: center; justify-content: center;
        }
        .lnf-tag button:hover { color: #c00; }

        /* ===== 底部操作栏 ===== */
        .lnf-bottom-bar {
            display: flex; align-items: center; gap: 16px;
            padding: 10px 16px; border-top: 1px solid #e0e0e0;
            background: #fafafa;
        }
        .lnf-bottom-switch {
            display: flex; align-items: center; gap: 6px;
            font-size: 13px; cursor: pointer; user-select: none;
        }
        .lnf-bottom-switch input { cursor: pointer; }
        .lnf-danger {
            margin-left: auto; padding: 6px 14px;
            border: 1px solid #c00; background: #fff; color: #c00;
            border-radius: 4px; cursor: pointer; font-size: 13px;
        }
        .lnf-danger:hover { background: #fff0f0; }
    `);

    // ==================== 菜单 ====================

    GM_registerMenuCommand('🔗 链接新标签配置', openPanel);
    GM_registerMenuCommand('📤 导出配置', exportConfig);

    // ==================== 初始化 ====================

    function init() {
        interceptClicks();
        processLinks();
        observeLinks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
