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

        if (isPython || true) { // 对所有语言生效，或者只针对 Python
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
        }
    }

    // 定时检查 IDE 是否加载并增强
    setInterval(enhanceIDE, 1000);
})();
