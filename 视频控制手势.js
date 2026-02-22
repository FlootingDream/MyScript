// ==UserScript==
// @name         视频控制手势
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  支持视频网站全屏手势控制
// @author       Gemini
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        showHints: true,
        seekStep: 90, // 
        speedRate: 2.0, // 长按加速倍速
        speeds: [0.5, 1.0, 1.25, 1.5, 2.0, 3.0],  // 视频倍速选项
        longPressTime: 500,  // 长按判定时间
        deadZone: 15,
        hintBg: 'rgba(0,0,0,0.5)',
        btnBg: 'rgba(0,0,0,0.4)',
        menuBg: 'rgba(20,20,20,0.5)',
        autoHideTime: 2000 // 提示自动英超时间
    };

    let video = null;
    let startX, startY, startValue, mode, isDirectionLocked, longPressTimer;
    let autoHideTimer = null, msgTimer = null;
    let currentSpeed = 1.0;
    let isPanelVisible = false;
    let isSpeedMenuVisible = false;

    const gestureHud = document.createElement('div');
    const brightnessOverlay = document.createElement('div');
    const controlPanel = document.createElement('div');
    const speedMenu = document.createElement('div');

    function isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement); // 
    }

    function initStyles() {
        // 提示信息层级设为最高 
        Object.assign(gestureHud.style, {
            position: 'fixed', top: '10%', left: '50%', transform: 'translate(-50%, -50%)',
            padding: '12px 24px', color: '#fff', background: CONFIG.hintBg,
            borderRadius: '12px', zIndex: '2147483647', display: 'none', pointerEvents: 'none',
            fontSize: '18px', fontWeight: 'bold', backdropFilter: 'blur(10px)'
        });
        Object.assign(brightnessOverlay.style, {
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'black', opacity: 0, zIndex: '2147483646', pointerEvents: 'none'
        });
        Object.assign(controlPanel.style, {
            position: 'fixed', bottom: '3%', right: '3%', 
            display: 'none', flexDirection: 'row-reverse', alignItems: 'center',
            zIndex: '2147483647', pointerEvents: 'auto', gap: '5px'
        });
        Object.assign(speedMenu.style, {
            position: 'absolute', bottom: '125%', left: '0', width: '100%',
            display: 'none', flexDirection: 'column', gap: '0px',
            zIndex: '2147483647', pointerEvents: 'auto'
        });
    }

    // 核心修复：针对 YouTube 的全屏容器挂载逻辑 
    function forceMountUI() {
        let target = document.fullscreenElement || document.webkitFullscreenElement || document.body;
        
        // 如果是 YouTube 这种复杂的容器结构 
        if (target && !target.contains(controlPanel)) {
            target.appendChild(brightnessOverlay);
            target.appendChild(gestureHud);
            target.appendChild(controlPanel);
        }
    }

    function showMsg(text, autoHide = true) {
        if (!CONFIG.showHints) return;
        forceMountUI();
        gestureHud.textContent = text;
        gestureHud.style.display = 'block';
        if (msgTimer) clearTimeout(msgTimer);
        if (autoHide) {
            msgTimer = setTimeout(() => { gestureHud.style.display = 'none'; }, 1200);
        }
    }

    function hidePanel() {
        isPanelVisible = false;
        controlPanel.style.display = 'none';
        speedMenu.style.display = 'none';
        isSpeedMenuVisible = false;
        if (autoHideTimer) clearTimeout(autoHideTimer);
    }

    function resetAutoHide() {
        if (autoHideTimer) clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(() => { if (isPanelVisible) hidePanel(); }, CONFIG.autoHideTime);
    }

    function createBtn(text, style = {}) {
        const btn = document.createElement('div');
        Object.assign(btn.style, {
            padding: '10px 16px', background: CONFIG.btnBg, color: '#fff',
            borderRadius: '8px', fontSize: '14px', backdropFilter: 'blur(5px)',
            border: '1px solid rgba(255,255,255,0.2)', userSelect: 'none', textAlign: 'center'
        }, style);
        btn.textContent = text;
        return btn;
    }

    // --- 事件监听 ---
    document.addEventListener('touchstart', (e) => {
        if (!isFullscreen()) return; // 修复非全屏误触

        video = document.querySelector('video');
        if (!video || e.touches.length > 1) return;

        if (isPanelVisible && !controlPanel.contains(e.target)) {
            hidePanel();
            return;
        }

        startX = e.touches[0].clientX; 
        startY = e.touches[0].clientY;
        isDirectionLocked = false; 
        mode = null;

        longPressTimer = setTimeout(() => {
            if (!isDirectionLocked && isFullscreen()) {
                mode = 'speed';
                video.playbackRate = CONFIG.speedRate;
                showMsg(`${CONFIG.speedRate}X >>`, false);
            }
        }, CONFIG.longPressTime);
    }, { passive: false, capture: true }); // 使用 capture 确保优先于 YouTube 原生事件 

    document.addEventListener('touchmove', (e) => {
        if (!isFullscreen() || !video || mode === 'speed' || controlPanel.contains(e.target)) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = startY - touch.clientY;

        if (!isDirectionLocked) {
            if (Math.abs(deltaX) > CONFIG.deadZone || Math.abs(deltaY) > CONFIG.deadZone) {
                clearTimeout(longPressTimer);
                isDirectionLocked = true;
                forceMountUI();
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    mode = 'seek';
                    startValue = video.currentTime;
                } else {
                    if (startX < window.innerWidth / 3) {
                        mode = 'brightness';
                        startValue = 1 - parseFloat(brightnessOverlay.style.opacity);
                    } else if (startX > window.innerWidth * 2 / 3) {
                        mode = 'volume';
                        startValue = video.volume;
                    }
                }
            }
        }

        if (mode) {
            e.preventDefault();
            e.stopImmediatePropagation(); // 阻止 YouTube 原生滑动 
            if (mode === 'brightness') {
                let b = Math.max(0.05, Math.min(1, startValue + (deltaY / (window.innerHeight * 0.5))));
                brightnessOverlay.style.opacity = 1 - b;
                showMsg(`亮度: ${Math.round(b * 100)}%`, false);
            } else if (mode === 'volume') {
                let v = Math.max(0, Math.min(1, startValue + (deltaY / (window.innerHeight * 0.5))));
                video.volume = v;
                showMsg(`音量: ${Math.round(v * 100)}%`, false);
            } else if (mode === 'seek') {
                let target = Math.max(0, Math.min(video.duration, startValue + (deltaX / window.innerWidth) * CONFIG.seekStep));
                video.currentTime = target;
                const format = (s) => {
                    let res = new Date(s * 1000).toISOString().substr(11, 8);
                    return res.startsWith("00:") ? res.substr(3) : res;
                };
                showMsg(`${format(target)} / ${format(video.duration)}`, false);
            }
        }
    }, { passive: false, capture: true });

    document.addEventListener('touchend', (e) => {
        clearTimeout(longPressTimer);
        if (!isFullscreen()) return;

        if (!isDirectionLocked && mode !== 'speed' && !controlPanel.contains(e.target)) {
            if (!isPanelVisible) {
                isPanelVisible = true;
                controlPanel.style.display = 'flex';
                forceMountUI();
                resetAutoHide();
            } else {
                hidePanel();
            }
        }
        
        if (mode === 'speed') {
            video.playbackRate = currentSpeed;
            gestureHud.style.display = 'none';
        } else if (mode) {
            if (msgTimer) clearTimeout(msgTimer);
            msgTimer = setTimeout(() => { gestureHud.style.display = 'none'; }, 600);
        }
        mode = null;
    }, { capture: true });

    // --- 初始化 UI ---
    initStyles();
    const btnExit = createBtn('⛶');
    btnExit.onclick = (e) => { 
        e.stopPropagation();
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        hidePanel(); 
    };

    const btnSpeed = createBtn('1.0X', { position: 'relative' });
    btnSpeed.onclick = (e) => {
        e.stopPropagation();
        isSpeedMenuVisible = !isSpeedMenuVisible;
        speedMenu.style.display = isSpeedMenuVisible ? 'flex' : 'none';
        resetAutoHide();
    };

    const btnQuality = createBtn('画质');
    btnQuality.onclick = (e) => {
        e.stopPropagation();
        // 针对 YouTube 的设置按钮选择器 
        const qBtn = document.querySelector('.ytp-settings-button, .ytm-settings-button, [aria-label*="设置"]');
        if (qBtn) { qBtn.click(); hidePanel(); }
        else { showMsg("未检测到菜单"); resetAutoHide(); }
    };

    CONFIG.speeds.reverse().forEach(s => {
        const item = createBtn(`${s}X`, { background: CONFIG.menuBg, padding: '8px', marginBottom: '2px' });
        item.onclick = (e) => { 
            e.stopPropagation(); 
            video = document.querySelector('video');
            if (video) {
                currentSpeed = s;
                video.playbackRate = s;
                btnSpeed.childNodes[0].textContent = `${s}X`;
                hidePanel();
                showMsg(`倍速: ${s}X`);
            }
        };
        speedMenu.appendChild(item);
    });
    btnSpeed.appendChild(speedMenu);
    controlPanel.append(btnExit, btnSpeed, btnQuality);

    // 持续监控全屏状态，防止 YouTube 退出全屏后 UI 残留 
    setInterval(() => {
        if (!isFullscreen() && isPanelVisible) hidePanel();
    }, 1000);

})();