// ==UserScript==
// @name         NIIT-OJ-Utils (NIIT OJ 实用工具)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  NIIT OJ 增强工具：题目导航(上一题/下一题)、新窗口打开题目讨论等
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

    function mainLoop() {
        addNavButtons();
        handleDiscussionTab();
    }

    // 启动轮询
    log('脚本已启动');
    setInterval(mainLoop, 800);

})();