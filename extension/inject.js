(function() {
    // 拦截 XMLHttpRequest
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function(method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    // 辅助函数：捕获标签信息
    function captureTags(res) {
        try {
            let tagsFound = [];
            
            // Case 1: Problem Detail (data.tags)
            if (res.data && Array.isArray(res.data.tags)) {
                tagsFound = res.data.tags;
            }
            // Case 2: Problem List (data.records[i].tags)
            else if (res.data && (res.data.records || res.data.data) && Array.isArray(res.data.records || res.data.data)) {
                const list = res.data.records || res.data.data;
                list.forEach(item => {
                    if (Array.isArray(item.tags)) {
                        tagsFound = tagsFound.concat(item.tags);
                    }
                });
            }
            // Case 3: Tag List API (data is array of tags)
            else if (res.data && Array.isArray(res.data) && res.data.length > 0 && res.data[0].name && res.data[0].id) {
                 tagsFound = res.data;
            }

            if (tagsFound.length > 0) {
                let tagMap = {};
                try {
                    tagMap = JSON.parse(window.sessionStorage.getItem('niit_oj_tag_map') || '{}');
                } catch (e) {}

                let updated = false;
                tagsFound.forEach(tag => {
                    if (tag && tag.id && tag.name) {
                        if (!tagMap[tag.name]) {
                            tagMap[tag.name] = tag.id;
                            updated = true;
                        }
                    }
                });

                if (updated) {
                    window.sessionStorage.setItem('niit_oj_tag_map', JSON.stringify(tagMap));
                    console.log('[NIIT-OJ-Utils] Updated Tag Map:', Object.keys(tagMap).length);
                }
            }
        } catch (e) {}
    }

    XHR.send = function(postData) {
        this.addEventListener('load', function() {
            // 尝试捕获标签
            try {
                const res = JSON.parse(this.responseText);
                captureTags(res);
            } catch (e) {}

            // 检查是否是提交接口
            // 通常包含 /submit-problem-judge 或 /submit
            if (this._url && (this._url.includes('/submit') || this._url.includes('judge'))) {
                try {
                    const res = JSON.parse(this.responseText);
                    console.log('[NIIT-OJ-Utils] Intercepted response:', this._url, res);
                    
                    let subId = null;
                    
                    // 尝试解析 ID
                    if (res.data) {
                        if (typeof res.data === 'object') {
                            // 增加 submitId 字段支持
                            subId = res.data.id || res.data.submissionId || res.data.submission_id || res.data.submitId;
                        } else if (typeof res.data === 'string' || typeof res.data === 'number') {
                            // 有时候直接返回 ID
                            subId = res.data;
                        }
                    }

                    if (subId) {
                        window.sessionStorage.setItem('niit_oj_last_submission_id', subId);
                        console.log('[NIIT-OJ-Utils] Captured Submission ID:', subId);
                    }
                } catch (e) {
                    console.error('[NIIT-OJ-Utils] Failed to parse submission response', e);
                }
            }

            // 拦截训练题目列表
            if (this._url && (this._url.includes('training') && (this._url.includes('problem') || this._url.includes('list')))) {
                 try {
                    const res = JSON.parse(this.responseText);
                    // 适配不同的返回结构
                    const list = res.data.records || res.data.problemList || res.data;
                    
                    if (Array.isArray(list)) {
                         // 尝试从 URL 获取 training_id
                         let tid = null;
                         
                         // 1. 尝试从 Query Param 获取
                         try {
                             const urlObj = new URL(this._url, window.location.origin);
                             tid = urlObj.searchParams.get('training_id') || urlObj.searchParams.get('tid') || urlObj.searchParams.get('id');
                         } catch(e) {}

                         // 2. 尝试从 URL 路径获取
                         if (!tid) {
                             const match = this._url.match(/\/training\/(\d+)/);
                             if (match) tid = match[1];
                         }

                         if (tid) {
                             // 存储训练题目列表
                             window.sessionStorage.setItem(`niit_oj_training_list_${tid}`, JSON.stringify(list));
                             // 同时更新最后访问的训练ID
                             window.sessionStorage.setItem('niit_oj_last_training_id', tid);
                             console.log(`[NIIT-OJ-Utils] Captured Training List ${tid}:`, list.length);
                             
                             // 顺便捕获标签
                             captureTags(res);
                         }
                    }
                 } catch(e) {
                     console.error('[NIIT-OJ-Utils] Failed to parse training list', e);
                 }
            }

            // 拦截训练列表主页 (Training Main List) - 用于捕获分类ID
            if (this._url && this._url.includes('/training') && !this._url.includes('/problem')) {
                 try {
                    const res = JSON.parse(this.responseText);
                    const list = res.data.records || res.data.data || res.data;
                    
                    if (Array.isArray(list)) {
                        let catMap = {};
                        try {
                            catMap = JSON.parse(window.sessionStorage.getItem('niit_oj_training_category_map') || '{}');
                        } catch(e) {}
                        
                        let updated = false;
                        list.forEach(item => {
                            // 捕获 categoryId 和 categoryName
                            // 1. 直接字段
                            if (item.categoryId && item.categoryName) {
                                if (!catMap[item.categoryName]) {
                                    catMap[item.categoryName] = item.categoryId;
                                    updated = true;
                                }
                            }
                            // 2. 嵌套对象 (item.category.id)
                            else if (item.category && item.category.id && item.category.name) {
                                if (!catMap[item.category.name]) {
                                    catMap[item.category.name] = item.category.id;
                                    updated = true;
                                }
                            }
                        });
                        
                        if (updated) {
                            window.sessionStorage.setItem('niit_oj_training_category_map', JSON.stringify(catMap));
                            console.log('[NIIT-OJ-Utils] Updated Training Category Map');
                        }
                    }
                 } catch(e) {}
            }

            // 拦截提交列表 (submission list)
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
                        // 简单验证是否是提交记录 (检查是否有 id/submitId 和 status/pid)
                        const first = list[0];
                        if ((first.id || first.submitId) && (first.status !== undefined || first.pid !== undefined || first.displayPid !== undefined)) {
                             window.sessionStorage.setItem('niit_oj_submission_list', JSON.stringify(list));
                             console.log('[NIIT-OJ-Utils] Captured Submission List:', list.length);
                        }
                    }
                } catch (e) {}
            }

            // 拦截题目列表 (problem list)
            if (this._url && (this._url.includes('problem') && !this._url.includes('submit') && !this._url.includes('judge'))) {
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
                        // 检查是否包含 id 和 title，确保是题目列表
                        if ((first.id || first.problemId) && first.title) {
                             const simpleList = list.map(p => ({
                                 id: p.id || p.problemId,
                                 title: p.title,
                                 displayId: p.displayId || p.problemId || p.id
                             }));
                             
                             window.sessionStorage.setItem('niit_oj_problem_list', JSON.stringify(simpleList));
                             console.log('[NIIT-OJ-Utils] Captured Problem List:', simpleList.length);
                        }
                    }
                } catch (e) {}
            }
        });
        return send.apply(this, arguments);
    };

    // 拦截 fetch (以防万一)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch(...args);
        const clone = response.clone();
        const url = args[0] instanceof Request ? args[0].url : args[0];

        // 尝试捕获标签
        clone.json().then(data => {
            captureTags(data);
        }).catch(e => {});

        if (url && (url.includes('/submit') || url.includes('judge'))) {
            clone.json().then(data => {
                console.log('[NIIT-OJ-Utils] Intercepted fetch response:', url, data);
                let subId = null;
                if (data.data) {
                    if (typeof data.data === 'object') {
                        subId = data.data.id || data.data.submissionId || data.data.submission_id || data.data.submitId;
                    } else if (typeof data.data === 'string' || typeof data.data === 'number') {
                        subId = data.data;
                    }
                }
                if (subId) {
                    window.sessionStorage.setItem('niit_oj_last_submission_id', subId);
                    console.log('[NIIT-OJ-Utils] Captured Submission ID (fetch):', subId);
                }
            }).catch(e => {});
        }

        // 拦截 fetch 列表
        if (url && (url.includes('submission') || url.includes('record') || url.includes('list'))) {
            clone.json().then(res => {
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
                            console.log('[NIIT-OJ-Utils] Captured Submission List (fetch):', list.length);
                    }
                }
            }).catch(e => {});
        }

        // 拦截 fetch 题目列表
        if (url && (url.includes('problem') && !url.includes('submit') && !url.includes('judge'))) {
            clone.json().then(res => {
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
                    // 检查是否包含 id 和 title，确保是题目列表
                    if ((first.id || first.problemId) && first.title) {
                         const simpleList = list.map(p => ({
                             id: p.id || p.problemId,
                             title: p.title,
                             displayId: p.displayId || p.problemId || p.id
                         }));
                         
                         window.sessionStorage.setItem('niit_oj_problem_list', JSON.stringify(simpleList));
                         console.log('[NIIT-OJ-Utils] Captured Problem List (fetch):', simpleList.length);
                    }
                }
            }).catch(e => {});
        }

        return response;
    };

    // --- IDE 增强功能 ---
    function enhanceIDE() {
        // 1. 查找 CodeMirror 实例
        const cmElement = document.querySelector('.CodeMirror');
        if (!cmElement || !cmElement.CodeMirror) return;

        const cm = cmElement.CodeMirror;
        const problemId = window.location.pathname.split('/').pop();
        const storageKey = `niit_oj_code_${problemId}`;

        // 2. 自动保存/恢复代码
        // 恢复
        if (!cm._hasRestoredCache) {
            const cachedCode = localStorage.getItem(storageKey);
            if (cachedCode && cachedCode.trim() !== '') {
                // 只有当编辑器内容为空或默认模板时才覆盖? 
                // 或者直接覆盖但给提示? 
                // 简单起见，如果编辑器内容很短(可能是模板)，则覆盖
                if (cm.getValue().length < 50 || confirm('检测到本地缓存的代码，是否恢复？')) {
                    cm.setValue(cachedCode);
                    console.log('[NIIT-OJ-Utils] Code restored from cache');
                }
            }
            cm._hasRestoredCache = true;
        }

        // 保存
        if (!cm._hasBindSave) {
            cm.on('change', () => {
                localStorage.setItem(storageKey, cm.getValue());
            });
            cm._hasBindSave = true;
        }

        // 3. 优化 Tab 和 缩进 (针对 Python)
        // 检查当前语言是否是 Python
        // 我们可以通过检查页面上的语言选择器，或者简单地应用通用配置
        // CodeMirror 的 extraKeys 可以覆盖默认行为
        
        // 获取当前模式/语言
        const mode = cm.getOption('mode');
        const isPython = mode === 'python' || (typeof mode === 'object' && mode.name === 'python');

        // 修复：只在未配置时应用，避免重复设置导致选择丢失
        if (!cm._hasConfiguredOptions && (isPython || true)) { // 对所有语言生效，或者只针对 Python
            // 强制 Tab 为 4 个空格
            cm.setOption('indentUnit', 4);
            cm.setOption('tabSize', 4);
            cm.setOption('indentWithTabs', false); // 使用空格代替 Tab
            
            // 优化按键绑定
            const extraKeys = cm.getOption('extraKeys') || {};
            
            // Tab: 缩进 (如果选中多行则缩进多行，否则插入空格)
            // Shift-Tab: 反缩进
            // Backspace: 智能删除 (一次删除4个空格)
            
            Object.assign(extraKeys, {
                "Tab": function(cm) {
                    if (cm.somethingSelected()) {
                        cm.indentSelection("add");
                    } else {
                        // 插入 4 个空格
                        cm.replaceSelection("    ", "end");
                    }
                },
                "Shift-Tab": "indentLess",
                "Backspace": function(cm) {
                    // 智能删除：如果光标前是 4 个空格，则一次删除
                    const cursor = cm.getCursor();
                    const line = cm.getLine(cursor.line);
                    const beforeCursor = line.slice(0, cursor.ch);
                    
                    if (cursor.ch >= 4 && beforeCursor.endsWith("    ")) {
                        // 删除 4 个字符
                        cm.replaceRange("", {line: cursor.line, ch: cursor.ch - 4}, {line: cursor.line, ch: cursor.ch});
                    } else {
                        // 默认删除
                        cm.execCommand("delCharBefore");
                    }
                }
            });
            
            cm.setOption('extraKeys', extraKeys);
            cm._hasConfiguredOptions = true;
        }
        
        // 4. 恢复 IDE 设置 (Theme, FontSize, TabLength)
        if (!cm._hasRestoredSettings) {
            try {
                const savedSettings = JSON.parse(localStorage.getItem('niit_oj_ide_settings') || '{}');
                if (savedSettings.theme) {
                    // 转换主题名
                    let cmTheme = savedSettings.theme.toLowerCase().trim().replace(/\s+/g, '-');
                    if (cmTheme.includes('solarized')) cmTheme = 'solarized';
                    cm.setOption('theme', cmTheme);
                }
                // Font Size 需要操作 DOM，这里暂时只处理 CodeMirror 选项
                // Tab Length
                if (savedSettings.tabLength) {
                    const tabLen = parseInt(savedSettings.tabLength);
                    cm.setOption('indentUnit', tabLen);
                    cm.setOption('tabSize', tabLen);
                }
                // 字体大小通常是外部 CSS 控制，或者 .CodeMirror 的 style
                if (savedSettings.fontSize) {
                    cmElement.style.fontSize = savedSettings.fontSize;
                    cm.refresh();
                }
                cm._hasRestoredSettings = true;
                console.log('[NIIT-OJ-Utils] IDE settings restored:', savedSettings);
            } catch (e) {
                console.error('Failed to restore IDE settings', e);
            }
        }
    }

    // 注入设置保存按钮
    function injectSettingsSaveBtn() {
        // 查找设置弹窗
        const popovers = document.querySelectorAll('.el-popover');
        let settingPopover = null;
        
        popovers.forEach(p => {
            if (p.querySelector('.setting-title') && p.innerText.includes('设置')) {
                settingPopover = p;
            }
        });

        if (!settingPopover) return;

        // 检查是否已注入
        if (settingPopover.querySelector('#niit-oj-save-settings-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'niit-oj-save-settings-btn';
        btn.innerText = '保存设置到本地';
        btn.className = 'el-button el-button--primary el-button--mini';
        btn.style.cssText = 'width: 100%; margin-top: 10px;';
        
        btn.onclick = function() {
            try {
                // 直接从 CodeMirror 实例读取当前生效的配置
                const cmElement = document.querySelector('.CodeMirror');
                if (!cmElement || !cmElement.CodeMirror) {
                    alert('未找到编辑器实例');
                    return;
                }
                const cm = cmElement.CodeMirror;

                // 1. Theme
                const theme = cm.getOption('theme');

                // 2. Tab Length
                const tabLength = cm.getOption('indentUnit');

                // 3. Font Size
                // 优先从弹窗输入框读取，因为这是用户的意图，且 DOM 可能尚未更新
                let fontSize = '';
                const items = settingPopover.querySelectorAll('.setting-item');
                items.forEach(item => {
                    const nameEl = item.querySelector('.setting-item-name');
                    if (nameEl && nameEl.innerText.includes('字体')) {
                        const input = item.querySelector('input');
                        if (input) fontSize = input.value;
                    }
                });

                // 如果弹窗里没读到，再尝试从 DOM 读
                if (!fontSize) {
                    fontSize = cmElement.style.fontSize;
                }
                
                // 规范化 fontSize
                if (fontSize && !fontSize.endsWith('px') && !isNaN(parseInt(fontSize))) {
                    fontSize = fontSize + 'px';
                }

                const settings = {
                    theme: theme,
                    fontSize: fontSize,
                    tabLength: tabLength
                };

                localStorage.setItem('niit_oj_ide_settings', JSON.stringify(settings));
                alert(`设置已保存！\n主题: ${theme}\n字体: ${fontSize}\n缩进: ${tabLength}\n\n请刷新页面以使设置生效。`);

            } catch (e) {
                console.error('Failed to save settings', e);
                alert('保存失败，请查看控制台');
            }
        };

        settingPopover.appendChild(btn);
    }

    // 修复 IDE 选择问题 (Hybrid Mode: Native Selection -> CM Sync)
    function fixIDESelection() {
        // 1. CSS Fix
        if (!document.getElementById('niit-oj-ide-fix-style')) {
            const style = document.createElement('style');
            style.id = 'niit-oj-ide-fix-style';
            style.textContent = `
                .CodeMirror {
                    user-select: text !important;
                    -webkit-user-select: text !important;
                }
                /* 当处于原生选择模式时(鼠标按下拖动期间)，隐藏 CM 的选区和光标，避免视觉冲突 */
                .CodeMirror.using-native-selection .CodeMirror-selected,
                .CodeMirror.using-native-selection .CodeMirror-selectedtext {
                    background: transparent !important;
                }
                .CodeMirror.using-native-selection .CodeMirror-cursor {
                    display: none !important;
                    border-left-color: transparent !important;
                }
            `;
            document.head.appendChild(style);
        }

        // 2. JS Logic
        const cmElement = document.querySelector('.CodeMirror');
        if (!cmElement || !cmElement.CodeMirror) return;
        const cm = cmElement.CodeMirror;

        if (cm._hasSelectionFix) return;

        // 禁用 CM 拖拽，防止冲突
        cm.setOption('dragDrop', false);

        const enableNativeMode = () => {
            cmElement.classList.add('using-native-selection');
        };

        const disableNativeMode = () => {
            cmElement.classList.remove('using-native-selection');
        };

        // 核心同步逻辑：将原生选区状态同步给 CodeMirror，然后切换回 CodeMirror 接管
        const syncAndSwitchToCM = () => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) {
                disableNativeMode();
                return;
            }
            
            const range = sel.getRangeAt(0);
            // 确保选区在编辑器内
            if (!cmElement.contains(range.commonAncestorContainer)) {
                disableNativeMode();
                return;
            }

            try {
                const startRange = range.cloneRange();
                startRange.collapse(true);
                const startRect = startRange.getClientRects()[0];

                const endRange = range.cloneRange();
                endRange.collapse(false);
                const endRect = endRange.getClientRects()[0];

                if (startRect && endRect) {
                    const startPos = cm.coordsChar({ left: startRect.left, top: startRect.top }, 'window');
                    const endPos = cm.coordsChar({ left: endRect.left, top: endRect.top }, 'window');
                    
                    // 同步到 CM
                    if (range.collapsed) {
                        cm.setCursor(startPos);
                    } else {
                        cm.setSelection(startPos, endPos, { scroll: false, origin: 'niit-oj-sync' });
                    }
                }
            } catch (e) {
                console.error('Sync failed', e);
            }

            // 切换回 CM 模式：移除 CSS 类，让 CM 的光标和选区显示出来
            disableNativeMode();
            
            // 清除原生选区，避免视觉上出现两个选区
            sel.removeAllRanges();
            
            // 重新聚焦 CM，确保键盘事件能被 hidden textarea 捕获
            cm.focus();
            if (cm.getInputField) cm.getInputField().focus();
        };

        // Mousedown: 开始原生选择模式
        cmElement.addEventListener('mousedown', (e) => {
            // 右键或滚动条不处理
            if (e.button === 2 || 
                e.target.closest('.CodeMirror-scrollbar-filler') || 
                e.target.closest('.CodeMirror-gutter')) return;

            enableNativeMode();
            
            // 关键修复：阻止冒泡，防止 CodeMirror 接收事件并调用 preventDefault()
            // 这样浏览器才能立即响应 mousedown 并开始原生选区，解决"需要点击两次"的问题
            e.stopPropagation();

            // 确保编辑器获得焦点
            if (!cm.hasFocus()) {
                cm.focus();
            }
        }, true); // Capture phase

        // Mousemove: 拦截拖拽，防止 CM 在拖动过程中更新选区导致跳动
        cmElement.addEventListener('mousemove', (e) => {
            if (e.buttons === 1 && cmElement.classList.contains('using-native-selection')) {
                e.stopPropagation();
            }
        }, true); // Capture phase

        // Mouseup: 结束选择，同步数据并交还控制权
        document.addEventListener('mouseup', () => {
            if (cmElement.classList.contains('using-native-selection')) {
                syncAndSwitchToCM();
            }
        });

        // Dragstart: 阻止原生拖拽，防止文本被意外删除
        cmElement.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });

        // 5. 优化剪贴板处理：使用键盘拦截 + Clipboard API
        // 解释：原生 copy/cut/paste 事件在不同浏览器/焦点状态下不稳定，改用 keydown 拦截并使用 navigator.clipboard
        const clipboardKeyHandler = async (e) => {
            const isAccel = e.ctrlKey || e.metaKey;
            if (!isAccel) return;

            const key = (e.key || '').toLowerCase();
            if (!['c', 'x', 'v'].includes(key)) return;

            // 只在编辑器激活/相关时拦截
            const activeInCm = cmElement.contains(document.activeElement) || cmElement.classList.contains('using-native-selection');
            if (!activeInCm) return;

            // 立即阻止默认行为和冒泡，防止浏览器处理和重复触发
            e.preventDefault();
            e.stopPropagation();

            // 如果当前处于原生选区模式，先同步选区到 CM
            if (cmElement.classList.contains('using-native-selection') && typeof syncAndSwitchToCM === 'function') {
                try { syncAndSwitchToCM(); } catch (e) {}
            }

            try {
                if (key === 'c') {
                    if (cm.somethingSelected()) {
                        const text = cm.getSelection();
                        try {
                            await navigator.clipboard.writeText(text);
                        } catch (err) {
                            // 退回到 execCommand 方案
                            const ta = document.createElement('textarea');
                            ta.value = text;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            ta.remove();
                        }
                    }
                } else if (key === 'x') {
                    if (cm.somethingSelected()) {
                        const text = cm.getSelection();
                        try {
                            await navigator.clipboard.writeText(text);
                        } catch (err) {
                            const ta = document.createElement('textarea');
                            ta.value = text;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            ta.remove();
                        }
                        // 删除选区内容
                        cm.replaceSelection('');
                    }
                } else if (key === 'v') {
                    let text = '';
                    try {
                        text = await navigator.clipboard.readText();
                    } catch (err) {
                        console.warn('[NIIT-OJ-Utils] Clipboard read failed', err);
                    }
                    if (text) {
                        cm.replaceSelection(text);
                    }
                }
            } catch (err) {
                console.error('[NIIT-OJ-Utils] clipboardKeyHandler error', err);
            }
        };

        // 绑定到编辑器元素 (移除 document 绑定以避免重复)
        cmElement.addEventListener('keydown', clipboardKeyHandler);

        cm._hasSelectionFix = true;
        console.log('[NIIT-OJ-Utils] IDE Selection Sync applied (Hybrid Mode + Clipboard Key Handling)');
    }

    // 同步设置到 UI 面板 (当弹窗显示时)
    function syncSettingsUI() {
        const popovers = document.querySelectorAll('.el-popover');
        let settingPopover = null;
        
        popovers.forEach(p => {
            if (p.querySelector('.setting-title') && p.innerText.includes('设置')) {
                settingPopover = p;
            }
        });

        if (!settingPopover) return;

        // 检查可见性 (display != none 且在 DOM 树中)
        const isVisible = settingPopover.style.display !== 'none' && settingPopover.offsetParent !== null;

        if (isVisible) {
            if (!settingPopover._hasSyncedUI) {
                try {
                    const savedSettings = JSON.parse(localStorage.getItem('niit_oj_ide_settings') || '{}');
                    const items = settingPopover.querySelectorAll('.setting-item');
                    
                    items.forEach(item => {
                        const nameEl = item.querySelector('.setting-item-name');
                        if (!nameEl) return;
                        const name = nameEl.innerText;
                        const input = item.querySelector('input');
                        if (!input) return;

                        if (name.includes('字体') && savedSettings.fontSize) {
                            input.value = savedSettings.fontSize;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        else if (name.includes('主题') && savedSettings.theme) {
                            input.value = savedSettings.theme;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        else if (name.includes('缩进') && savedSettings.tabLength) {
                            input.value = savedSettings.tabLength;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });
                    settingPopover._hasSyncedUI = true;
                    console.log('[NIIT-OJ-Utils] Settings UI synced');
                } catch (e) {
                    console.error('Sync UI failed', e);
                }
            }
        } else {
            // 弹窗隐藏时重置标志，以便下次打开时再次同步
            settingPopover._hasSyncedUI = false;
        }
    }

    // 定时检查 IDE 是否加载并增强
    setInterval(() => {
        enhanceIDE();
        injectSettingsSaveBtn();
        syncSettingsUI();
        fixIDESelection();
    }, 1000);
})();
