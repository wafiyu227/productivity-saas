// src/lib/authCallbackState.js
// A simple module-level flag that AuthCallback sets to true while processing
// This prevents AuthContext from racing with AuthCallback's redirect logic

let _isProcessingCallback = false;

export const authCallbackState = {
    get isProcessing() {
        return _isProcessingCallback;
    },
    startProcessing() {
        _isProcessingCallback = true;
        console.log('[AuthCallbackState] Callback processing started — suppressing AuthContext redirects');
    },
    stopProcessing() {
        _isProcessingCallback = false;
        console.log('[AuthCallbackState] Callback processing stopped — AuthContext redirects re-enabled');
    }
};