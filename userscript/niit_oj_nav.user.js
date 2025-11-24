// ==UserScript==
// @name         NIIT-OJ-Utils (NIIT OJ 实用工具)
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  NIIT OJ 增强工具：题目导航(上一题/下一题)、新窗口打开题目讨论、修复提交详情跳转
// @author       GitHub Copilot
// @match        https://oj.niit.com.cn/problem/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=niit.com.cn
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONTAINER_ID = 'niit-oj-nav-btns-v3';

    function log(msg) {
        console.log(`%c[NIIT OJ Utils] ${msg}`, 'color: #409EFF; font-weight: bold;');
    }

    function addNavButtons() {
        // 1. 寻找标题元素
        const titleElements = document.querySelectorAll('.panel-title');
        
        if (titleElements.length === 0) {
            return;
        }

        titleElements.forEach((titleElement, index) => {
            // 防止重复添加
            if (titleElement.querySelector(`#${CONTAINER_ID}`)) {
                return;
            }

            // 2. 解析 URL
            const currentUrl = window.location.href;
            const match = currentUrl.match(/\/problem\/(\d+)/);
            
            if (!match) {
                return;
            }

            const currentIdStr = match[1];
            const currentId = parseInt(currentIdStr, 10);

            // 3. 计算 ID
            const prevId = currentId - 1;
            const nextId = currentId + 1;
            const idLength = currentIdStr.length;
            const prevIdStr = prevId.toString().padStart(idLength, '0');
            const nextIdStr = nextId.toString().padStart(idLength, '0');

            // 4. 创建容器
            const btnContainer = document.createElement('div');
            btnContainer.id = CONTAINER_ID;
            
            // 强制样式：绝对定位在右侧
            btnContainer.style.cssText = `
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 9999;
                display: flex;
                gap: 10px;
            `;

            // 5. 按钮通用样式 (蓝色背景，白色文字)
            const btnStyle = `
                display: inline-block;
                background-color: #409EFF; 
                color: #ffffff !important;
                text-decoration: none;
                padding: 6px 15px;
                font-size: 12px;
                border-radius: 4px;
                border: 1px solid #409EFF;
                cursor: pointer;
                line-height: 1.5;
                font-family: sans-serif;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: all 0.3s;
            `;

            // 上一题
            if (prevId > 0) {
                const prevBtn = document.createElement('a');
                prevBtn.href = `/problem/${prevIdStr}`;
                prevBtn.innerText = '← 上一题';
                prevBtn.style.cssText = btnStyle;
                // 鼠标悬停效果
                prevBtn.onmouseover = () => { prevBtn.style.backgroundColor = '#66b1ff'; };
                prevBtn.onmouseout = () => { prevBtn.style.backgroundColor = '#409EFF'; };
                btnContainer.appendChild(prevBtn);
            }

            // 下一题
            const nextBtn = document.createElement('a');
            nextBtn.href = `/problem/${nextIdStr}`;
            nextBtn.innerText = '下一题 →';
            nextBtn.style.cssText = btnStyle;
            nextBtn.onmouseover = () => { nextBtn.style.backgroundColor = '#66b1ff'; };
            nextBtn.onmouseout = () => { nextBtn.style.backgroundColor = '#409EFF'; };
            btnContainer.appendChild(nextBtn);

            // 6. 插入 DOM
            // 确保父元素有定位属性
            const computedStyle = window.getComputedStyle(titleElement);
            if (computedStyle.position === 'static') {
                titleElement.style.position = 'relative';
            }
            
            titleElement.appendChild(btnContainer);
            log('导航按钮添加成功');
        });
    }

    // 新功能：在新窗口打开讨论
    function handleDiscussionTab() {
        const tab = document.getElementById('tab-myDiscussion');
        if (!tab || tab.dataset.hasListener) return;

        // 标记已处理
        tab.dataset.hasListener = 'true';

        // 使用捕获阶段拦截点击事件
        tab.addEventListener('click', function(e) {
            // 阻止 Vue 切换 Tab
            e.stopPropagation();
            e.preventDefault();

            // 获取题目 ID
            const currentUrl = window.location.href;
            const match = currentUrl.match(/\/problem\/(\d+)/);
            if (match) {
                const problemId = match[1];
                // 构造讨论页 URL
                const discussionUrl = `https://oj.niit.com.cn/discussion/${problemId}`;
                window.open(discussionUrl, '_blank');
                log('在新窗口打开了讨论页');
            }
        }, true);
        
        log('讨论区 Tab 监听已添加');
    }

    // 注入拦截代码
    function injectInterception() {
        if (document.getElementById('niit-oj-interceptor')) return;
        
        const script = document.createElement('script');
        script.id = 'niit-oj-interceptor';
        script.textContent = `
        (function() {
            const XHR = XMLHttpRequest.prototype;
            const open = XHR.open;
            const send = XHR.send;

            XHR.open = function(method, url) {
                this._url = url;
                return open.apply(this, arguments);
            };

            XHR.send = function(postData) {
                this.addEventListener('load', function() {
                    // 拦截提交
                    if (this._url && (this._url.includes('/submit') || this._url.includes('judge'))) {
                        try {
                            const res = JSON.parse(this.responseText);
                            let subId = null;
                            if (res.data) {
                                if (typeof res.data === 'object') {
                                    subId = res.data.id || res.data.submissionId || res.data.submission_id || res.data.submitId;
                                } else if (typeof res.data === 'string' || typeof res.data === 'number') {
                                    subId = res.data;
                                }
                            }
                            if (subId) {
                                window.sessionStorage.setItem('niit_oj_last_submission_id', subId);
                                console.log('[NIIT-OJ-Utils] Captured Submission ID:', subId);
                            }
                        } catch (e) {}
                    }
                    // 拦截列表
                    if (this._url && (this._url.includes('submission') || this._url.includes('record') || this._url.includes('list'))) {
                        try {
                            const res = JSON.parse(this.responseText);
                            let list = [];
                            if (res.data && Array.isArray(res.data)) {
                                list = res.data;
                            } else if (res.data && res.data.records && Array.isArray(res.data.records)) {
                                list = res.data.records;
                            } else if (res.data && res.data.data && Array.isArray(res.data.data)) {
                                list = res.data.data;
                            }
                            if (list.length > 0) {
                                const first = list[0];
                                if ((first.id || first.submitId) && (first.status !== undefined || first.pid !== undefined || first.displayPid !== undefined)) {
                                     window.sessionStorage.setItem('niit_oj_submission_list', JSON.stringify(list));
                                     console.log('[NIIT-OJ-Utils] Captured Submission List:', list.length);
                                }
                            }
                        } catch (e) {}
                    }
                });
                return send.apply(this, arguments);
            };
        })();
        `;
        (document.head || document.documentElement).appendChild(script);
        log('拦截脚本已注入');
    }

    // 修复提交详情跳转
    let redirectFixed = false;
    function fixSubmissionRedirect() {
        if (redirectFixed) return;
        document.addEventListener('click', function(e) {
            const target = e.target.closest('.submission-status');
            if (target) {
                const lastId = window.sessionStorage.getItem('niit_oj_last_submission_id');
                log('点击了状态标签，当前 ID: ' + lastId);
                if (lastId) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    window.open('/submission-detail/' + lastId, '_blank');
                }
            }
        }, true);
        redirectFixed = true;
        log('提交跳转修复已应用');
    }

    // 修复提交列表点击
    let listClickFixed = false;
    function fixSubmissionListClick() {
        if (listClickFixed) return;
        document.addEventListener('click', function(e) {
            const tableWrapper = e.target.closest('#pane-mySubmission .vxe-table--body-wrapper, #pane-mySubmission .vxe-table--fixed-left-wrapper, #pane-mySubmission .vxe-table--fixed-right-wrapper');
            if (!tableWrapper) return;
            const tr = e.target.closest('tr');
            if (!tr) return;
            const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
            const listStr = window.sessionStorage.getItem('niit_oj_submission_list');
            if (listStr) {
                try {
                    const list = JSON.parse(listStr);
                    if (list && list[rowIndex]) {
                        const item = list[rowIndex];
                        const subId = item.id || item.submitId || item.submissionId;
                        if (subId) {
                            log('列表点击检测. Row: ' + rowIndex + ', ID: ' + subId);
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            window.open('/submission-detail/' + subId, '_blank');
                        }
                    }
                } catch (err) {}
            }
        }, true);
        listClickFixed = true;
        log('列表点击修复已应用');
    }

    // 修复图片显示问题
    function fixImages() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            const rawSrc = img.getAttribute('src');
            if (!rawSrc) return;

            // Only target the specific broken pattern
            if (rawSrc.includes('/api/public/img/')) {
                // If we haven't touched this image yet
                if (img.getAttribute('data-fixed-attempt') === null) {
                    img.setAttribute('data-fixed-attempt', 'true'); // Mark as processing

                    // Extract the filename and ID
                    const filename = rawSrc.split('/').pop();
                    const fileId = filename.split('.')[0];
                    
                    // Define candidate paths
                    const candidates = [
                        `/public/img/${filename}`,
                        `/img/${filename}`,
                        `/api/img/${filename}`,
                        `/upload/${filename}`,
                        `/assets/img/${filename}`,
                        `/static/img/${filename}`,
                        `/file/${filename}`,
                        `/files/${filename}`,
                        `/image/${filename}`,
                        `/images/${filename}`,
                        `/api/file/${filename}`,
                        `/api/file/${fileId}`, // Try without extension
                        `/api/file/image/${fileId}`,
                        `/api/file/download/${fileId}`,
                        `https://oj.niit.com.cn/public/img/${filename}`,
                        `https://oj.niit.com.cn/api/public/img/${filename}`
                    ];

                    let attemptIndex = 0;

                    const tryNext = () => {
                        if (attemptIndex >= candidates.length) {
                            log(`All image load attempts failed for ${filename}`);
                            return;
                        }
                        const nextSrc = candidates[attemptIndex++];
                        log(`Trying image path: ${nextSrc}`);
                        
                        // Use fetch to check status code
                        fetch(nextSrc, { method: 'HEAD' })
                            .then(response => {
                                if (response.ok) {
                                    log(`Image fix success (HTTP ${response.status}): ${nextSrc}`);
                                    img.src = nextSrc;
                                } else {
                                    log(`Failed ${nextSrc}: HTTP ${response.status}`);
                                    tryNext();
                                }
                            })
                            .catch(err => {
                                log(`Failed ${nextSrc}: ${err.message}`);
                                tryNext();
                            });
                    };

                    // Start the chain
                    tryNext();
                }
            }
        });
    }

    function mainLoop() {
        addNavButtons();
        handleDiscussionTab();
        injectInterception();
        fixSubmissionRedirect();
        fixSubmissionListClick();
        fixImages();
    }

    // 启动轮询
    log('脚本已启动');
    setInterval(mainLoop, 800);

})();