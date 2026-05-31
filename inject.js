// This script runs in the MAIN world and overrides native dialogs
(function() {
    const noop = () => {};
    
    // Override alert
    window.alert = function(msg) {
        console.log('🚫 Intercepted native alert:', msg);
        return undefined;
    };
    
    // Override confirm
    window.confirm = function(msg) {
        console.log('🚫 Intercepted native confirm:', msg);
        return true; // Always accept
    };
    
    // Override prompt
    window.prompt = function(msg, defaultVal) {
        console.log('🚫 Intercepted native prompt:', msg);
        return defaultVal || "";
    };

    console.log('✅ Native dialogs suppressed in MAIN world');
})();
