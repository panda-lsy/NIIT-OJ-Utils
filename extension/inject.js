(function() {
    // 拦截 XMLHttpRequest
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function(method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function(postData) {
        this.addEventListener('load', function() {
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
        });
        return send.apply(this, arguments);
    };

    // 拦截 fetch (以防万一)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch(...args);
        const clone = response.clone();
        const url = args[0] instanceof Request ? args[0].url : args[0];

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

        return response;
    };
})();
