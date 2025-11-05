// ==UserScript==
// @name         新标签页打开链接
// @version      2.0
// @description  页面内的<a>标签链接在新的标签页中打开，支持自定义每个网站的排除规则
// @author       DeepSeek
// @downloadURL  https://raw.githubusercontent.com/FlootingDream/MyScript/refs/heads/main/%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5%E6%89%93%E5%BC%80%E9%93%BE%E6%8E%A5.js
// @updateURL    https://raw.githubusercontent.com/FlootingDream/MyScript/refs/heads/main/%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5%E6%89%93%E5%BC%80%E9%93%BE%E6%8E%A5.js

// @match        *://*.github.com/*
// @match        *://*.wikipedia.org/*
// @match        *://*.youtube.com/*
// @match        *://*.123av.com/*
// @match        *://*.netflav.com/*
// @match        *://*.jable.tv/*
// @match        *://*.javrate.com/*
// @match        *://*.nippondvd.com/*
// @match        *://*.youiv.info/*
// @match        *://*.pornhub.com/*
// @match        *://*.w91h.com/*
// @match        *://*.javlibrary.com/*
// @match        *://*.yckceo.com/*
// @match        *://*.ivworld.net/*
// @match        *://*.instagram.com/*
// @match        *://*.twitch.tv/*

// @match        *://annas-archive.org/*
// @match        *://linux.do/*
// @match        *://www.52pojie.cn/*
// @match        *://bbs.tampermonkey.net.cn/*
// @match        *://lemonlive.deno.dev/*
// @match        *://greasyfork.org/*
// @match        *://techgaun.github.io/*   

// @match        *://youiv.tv/*
// @match        *://u15dvdinfo.com/*
// @match        *://x.com/*
// @match        *://javtrailers.com/*
// @match        *://kanojodb.com/*
// @match        *://youiv19.com/*
// @match        *://ivfree.asia/*
// @match        *://xidol.net/*
// @match        *://aidol.asia/*
// @match        *://91porn.com/*
// @match        *://ipxn.tiffa-498gh.team/*

// @exclude-match   *://*.github.com/*/*/discussions/*
// @exclude-match   *://github.com/*/*/issues/new/choose

// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';
    const DEBUG = false;

    // 排除容器设置 (该容器内的<a>标签链接仍然在当前页面内打开) (遵循CSS选择器语法)
    // 语法：(1) .类名(class中的字符)：匹配class属性值为指定类名的元素 (类名选择器)
    //       (2) #id名(id中的字符)：匹配指定id的标签 (id选择器)
    //       (3) 标签名[属性名=属性值]：匹配该属性中包含属性值的标签 (属性值为字符串要加双引号)    
    //           标签名[属性名^=属性值]：匹配该属性中以属性值开头的标签
    //           标签名[属性名$=属性值]：匹配该属性中以属性值结尾的标签
    //           父标签名[属性名=属性值]>子标签名[属性名=属性值]
    //           注意：(3)中在只有属性名可以确定要查找的标签的情况下，标签名可以省略

    const excludeContainer = {
        // 全局默认规则
        '*': [
            'nav',                  // 所有导航
            '.pagination',          // 分页组件
            '[data-no-new-tab]'     // 标记不处理的链接
        ],

        'github.com': [
            '.AppHeader',           // 顶部导航
            'tr.js-file-line a',    // 代码行号
            '.react-directory-truncated-button', // 文件树展开按钮
            '[aria-label="Select a branch"]',  // 分支选择标签
            '[aria-labelledby="folders-and-files"]',// 代码
            'ul[class^="list-style-none ListItems-module__tabsContainer"]', // issue打开、关闭标签选择
            'div[class="paginate-container"]',
            'div[class="Layout-sidebar"]',
            'div[class="d-flex mt-2 flex-items-center flex-column flex-sm-column flex-md-column flex-lg-row"]',
            'div[align="right"]',
            'div[id="notification-shelf"]',
            'div[class="IssueCreatePane-module__createPaneContainer--QVEpz"]',
            'div[id="repos-file-tree"]',
            'div[id="file-results-list"]',
            'span[class="fgColor-muted"]',
            'div[id="year-list-container"]',
            'div[id$="list-view-metadata"]',
            'details-menu[class="select-menu-modal position-absolute right-0"]',
            'div[id="js-issues-toolbar"]',
            'div[class="RepositoryLabel-module__labelListWrapper--LLFcJ"]',
            'div[class="position-relative px-3 pb-3 pt-1"]',
            'div[data-testid="facets-pane"]',
            'div[id="symbols-pane"]',
            'div[class="d-flex"]',
            'div[class="d-flex flex-justify-end flex-wrap flex-lg-nowrap width-full"]',
            'span[class="Title-module__trailingBadgesContainer--mijcn"]',

            // 文档(doc.github.com)
            'div[data-testid="desktop-header"]',
            
        ],

        'youtube.com': [
            '#guide-content',       // 左侧导航
            '#player',              // 视频播放区
            '.yt-core-attributed-string__link', // 时间跳转
            'ytd-rich-section-renderer', // 推荐内容
            'div[id="items"]',
            'div[class="style-scope ytd-topbar-logo-renderer"]',
            'ytd-button-renderer[id="reply-button-end"]'
        ],

        'zhihu.com': [
            '.Topstory > div:first-child', // 推荐流
            '.Modal-wrapper',       // 弹窗
            '.Pagination'           // 分页
        ],

        'taobao.com': [
            '.site-nav',            // 顶部导航
            '.left-nav',            // 左侧分类
            '.pagination'           // 分页
        ],

        'ivfree.asia': [
            '#bottom-nav',
            'div[class="topchik-one clearfix"]',
            'div[class="topchik-two clearfix"]'
        ],

        'youiv.tv': [
            '.pg',
            '[title="少女偶像 youiv"]',
            '#category_84'
        ],
        
        'youiv.info': [
            'p[align="center"]'
        ],

        '123av.com': [
            'div[class="row wrap"]',
            'ul[class="pagination"]',
            'div[class="relative cursor"]',
        ],

        'linux.do': [
            'header[class="d-header"]',
            'nav[class="horizontal-overflow-nav "]',
            'div[class="sidebar-sections sidebar-sections-anonymous"]',
            'div[data-section-name="categories"]',
            'div[data-section-name="tags"]',
            'div[class="timeline-container"]'
        ],

        '52pojie.cn': [
            'ul[class="tb cl"]',
            '#p_btn',
            'td[class="plc"]',
            'a[rel="noopener noreferrer"]',
            'div[class="appl"]',
            '#hd',
            'div[id="jz52top"]'
            // 'a[title="吾爱破解 - 52pojie.cn"]'
        ],
        
        'netflav.com': [
            'div[class="desktop_header_0_root desktop_header_0_root_transparent"]',
            'div[class="animated fadeInRight"]',
            'div[class="play_item_root"]'
        ],

        'pornhub.com': [
            'div[id="headerWrapper"]',
            'nav[class="nf-categories-sidebar"]',
            'div[class="extraRelatedVid latestThumbDesign"]',

        ],
        
        'w91h.com': [
            'div[id="topmenu]',
            'div[id="toplogo"]',
            'div[id="leftmenu"]',
            'form[name="newpost"]',
        ],

        'javlibrary.com': [
            'div[id="topmenu]',
            'div[id="toplogo"]',
            'div[id="leftmenu"]',
            'form[name="newpost"]',
            'table[class="displaymode"]'
        ],

        'bbs.tampermonkey.net.cn': [
            'div[id="comiis_nv"]',
            'div[id="pt"]'
        ],

        'greasyfork.org': [
            'header[id="main-header"]',
            'div[id="install-area"]',
            'ul[id="script-links"]',
            'div[class="comment"]',
            'div[id="additional-info"]',
            'div[class="post-discussion"]'
        ],

        '91porn.com': [
            'div[class="navbar navbar-inverse navbar-fixed-top"]'
        ],

        'yckceo.com': [
            'div[class="layui-container"]'
        ],

        'u15dvdinfo.com': [
            '#header',
            'h1[class="idol"]',
            'table[class="pro_info"]',
            'div[class="p_image"]'
        ],

        'ipxn.tiffa-498gh.team': [
            '#hd',
            'ul[class="tb cl"]'
        ],

        'ivworld.net': [
            '#header'
        ],

        'instagram.com': [
            'div[class="x2lah0s x1to3lk4 x1n2onr6 xh8yej3"]',
            'div[class="x1iyjqo2 xh8yej3"]'
        ],

        'twitch.tv': [
            '.top-nav__menu',
            '.side-nav',
            '.settings-tabs'
        ]
    };

    // ======================
    // 系统保留规则 (勿修改)
    // ======================
    const systemExcludeContainer = [
        'a[target="_self"]',
        'a[download]',
        'a[href^="javascript:"]',
        'a[href^="mailto:"]'
    ];


    function getCurrentRules() {
        const domain = window.location.hostname.replace(/^www\./, '');
        const siteKey = Object.keys(excludeContainer).find(key =>
            key !== '*' && domain.endsWith(key)
        ) || '*';

        return [
            ...systemExcludeContainer,
            ...(excludeContainer[siteKey] || []),
            ...(excludeContainer['*'] || [])
        ];
    }

    function processLink(a) {
        try {
            if (a.target === '_blank') return;
            if (['javascript:', 'mailto:', 'tel:'].includes(a.protocol)) return;

            const rules = getCurrentRules();
            const isExcluded = rules.some(selector =>
                a.matches(selector) || a.closest(selector)
            );

            if (!isExcluded) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                if (DEBUG) console.log(`[处理] ${a.href}`);
            } else if (DEBUG) {
                console.log(`[排除] ${a.href} 原因：${rules.find(s =>
                    a.matches(s) || a.closest(s)
                )}`);
            }
        } catch (e) {
            DEBUG && console.error('链接处理错误:', e);
        }
    }

    // 深度扫描器
    const deepScan = root => {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: n => n.tagName === 'A' ?
                    NodeFilter.FILTER_ACCEPT :
                    NodeFilter.FILTER_SKIP
            }
        );

        let node;
        while ((node = walker.nextNode())) processLink(node);
    };

    // 全局监听器
    const observer = new MutationObserver(muts => {
        muts.forEach(mut => {
            mut.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches('a')) processLink(node);
                    deepScan(node);
                }
            });
        });
    });

    // 事件拦截
    document.addEventListener('click', e => {
        const a = e.target.closest('a');
        if (!a || !a.href) return;

        const rules = getCurrentRules();
        const isExcluded = rules.some(selector =>
            a.matches(selector) || a.closest(selector)
        );

        if (!isExcluded) {
            e.stopImmediatePropagation();
            e.preventDefault();
            window.open(a.href, '_blank');
            DEBUG && console.log(`[拦截] ${a.href}`);
        }
    }, { capture: true, passive: false });

    // 初始化
    function init() {
        deepScan(document.documentElement);
        observer.observe(document, {
            subtree: true,
            childList: true,
            attributes: false
        });

        // 兼容SPA路由
        let lastHref = location.href;
        setInterval(() => {
            if (location.href !== lastHref) {
                lastHref = location.href;
                deepScan(document.body);
            }
        }, 1000);
    }

    // 安全启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
