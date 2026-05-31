// QEC Form Auto-Filler Content Script
// SILENT VERSION: All alert() calls removed.

// Native alert suppression is now handled by inject.js in the MAIN world via manifest.json

(async function() {
    console.log('🟢 QEC Auto-Filler content script loaded');
    console.log('📍 Current URL:', window.location.href);
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        console.log('⏳ Waiting for DOM...');
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    console.log('✅ DOM ready');

    // Check if automation is enabled
    const data = await chrome.storage.local.get(['automationState', 'defaultGrade', 'exceptions', 'enableReport']);
    const state = data.automationState;
    
    // Force enable report for verification as requested
    const enableReport = true;
    
    console.log('🔍 Automation state:', JSON.stringify(state));
    console.log('🔍 Default grade:', data.defaultGrade);
    console.log('🔍 Exceptions:', JSON.stringify(data.exceptions));

    if (!state || !state.isRunning) {
        console.log('❌ Automation not running');
        return;
    }
    
    console.log('✅ Automation IS running!');

    // Detect current page type
    const currentPage = detectPageType();
    console.log('📄 Detected page type:', currentPage);
    
    if (!currentPage) {
        console.log('❌ Not on a QEC form page');
        return;
    }

    console.log(`✅ Page type confirmed: ${currentPage}`);
    
    // Show status on page title
    document.title = '🤖 Filling ' + currentPage + ' form...';

    // Run automation after short delay to ensure page is loaded
    console.log('⏳ Waiting 2s before starting automation...');
    setTimeout(() => {
        console.log('🚀 Starting automation NOW!');
        createDebugOverlay();
        updateDebugOverlay('Starting...', false, currentPage);
        runAutomation(currentPage, data);
    }, 2000);
})();

function createDebugOverlay() {
    const div = document.createElement('div');
    div.id = 'qec-debug-overlay';
    div.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.9); color: white; padding: 15px; border-radius: 8px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; width: 280px; border: 1px solid #555; box-shadow: 0 8px 24px rgba(0,0,0,0.5);';
    div.innerHTML = `
        <div style="font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 10px; padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>🤖 QEC DEBUGGER</span>
            <span id="qec-debug-form" style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; text-transform: uppercase;">-</span>
        </div>
        <div id="qec-debug-content" style="line-height: 1.4;">Initializing...</div>
    `;
    document.body.appendChild(div);
}

function updateDebugOverlay(msg, isMatch = false, formType = null, grade = null) {
    const content = document.getElementById('qec-debug-content');
    const formBadge = document.getElementById('qec-debug-form');
    
    if (formBadge && formType) {
        formBadge.textContent = formType;
        const colors = { 'Teacher': '#3b82f6', 'Online': '#8b5cf6', 'Course': '#ec4899' };
        formBadge.style.background = colors[formType] || '#3b82f6';
    }

    if (content) {
        const color = isMatch ? '#10b981' : '#fff';
        const gradeMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        const gradeLabel = grade ? `<span style="float: right; background: #444; padding: 0 6px; border-radius: 3px; font-weight: bold;">${gradeMap[grade] || grade}</span>` : '';
        content.innerHTML = `<div style="color: ${color}">${msg}${gradeLabel}</div>`;
    }
}



async function updateProgress(pageType, current, total, itemName = '', grade = '') {
    const formOrder = ['Teacher', 'Online', 'Course'];
    const formIndex = formOrder.indexOf(pageType);
    
    // Calculate overall progress
    const baseProgress = (formIndex / formOrder.length) * 100;
    const currentFormProgress = (current / total) * (100 / formOrder.length);
    const overallProgress = Math.round(baseProgress + currentFormProgress);

    const gradeMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
    const gradeLabel = gradeMap[grade] || grade;
    
    let detail = `[${pageType}] Processing: ${current} of ${total}`;
    if (itemName && gradeLabel) {
        detail = `[${pageType}] Assigned ${gradeLabel} to ${itemName}`;
    }

    await chrome.storage.local.set({
        automationProgress: {
            percent: overallProgress,
            detail: detail,
            currentForm: pageType,
            currentCount: current,
            totalCount: total
        }
    });
}

function detectPageType() {
    const url = window.location.href;
    
    if (url.includes('p10.aspx') || document.querySelector('#ctl00_ContentPlaceHolder2_ddlTeacher')) {
        return 'Teacher';
    } else if (url.includes('p10a_learning_online_form.aspx') || document.querySelector('#ctl00_ContentPlaceHolder1_cmb_courses')) {
        return 'Online';
    } else if (url.includes('p1.aspx') || document.querySelector('#ctl00_ContentPlaceHolder2_cmb_courses')) {
        return 'Course';
    } else if (url.includes('student-perfomas.aspx')) {
        return 'MainPage';
    }
    
    return null;
}

async function runAutomation(pageType, data) {
    const state = data.automationState || {};
    const defaultGrade = data.defaultGrade || '2';
    const allExceptions = data.exceptions || [];
    const enableReport = data.enableReport || false;

    if (pageType === 'MainPage') {
        // Navigate to the appropriate form
        await navigateToForm(state.currentForm || 'Teacher');
        return;
    }

    // Check if we're on the expected form type
    if (pageType !== state.currentForm) {
        console.log(`Page mismatch: expected ${state.currentForm}, got ${pageType}`);
        // Update state to match current page
        state.currentForm = pageType;
        state.currentIndex = 0;
        await chrome.storage.local.set({ automationState: state });
    }

    // Get dropdown element based on page type
    const dropdownInfo = getDropdownElement(pageType);
    if (!dropdownInfo) {
        console.log('Dropdown not found');
        return;
    }

    const { element: dropdown, totalOptions } = dropdownInfo;
    
    // Initial progress update for the page
    await updateProgress(pageType, 1, totalOptions + 1);

    // Check if we've processed all items in this form
    if (totalOptions <= 0) {
        console.log(`No items to process in ${pageType} form`);
        // Ensure progress shows 100% for this section before moving
        await updateProgress(pageType, 1, 1);
        await moveToNextForm(pageType, state);
        return;
    }

    // Process current item
    const itemName = dropdown.options[1].text; // Always select the first available option (index 1, since 0 is "--Select--")
    console.log(`Processing item: ${itemName} (${totalOptions} remaining)`);

    // Get grade for this item
    const categoryExceptions = allExceptions.filter(ex => ex.category === pageType);
    const grade = getGradeFor(itemName, categoryExceptions, defaultGrade, pageType);
    
    console.log(`[FINAL DECISION] Item: "${itemName}", Assigned Grade: ${grade}`);

    // Log evaluation
    await logEvaluation(itemName, grade, pageType);

    // Update progress with specific item and grade
    await updateProgress(pageType, 1, totalOptions + 1, itemName, grade);

    // Fill the form
    await fillForm(pageType, dropdown, grade);
}

function getDropdownElement(pageType) {
    let element = null;
    
    if (pageType === 'Teacher') {
        element = document.querySelector('#ctl00_ContentPlaceHolder2_ddlTeacher');
    } else if (pageType === 'Online') {
        element = document.querySelector('#ctl00_ContentPlaceHolder1_cmb_courses');
    } else if (pageType === 'Course') {
        element = document.querySelector('#ctl00_ContentPlaceHolder2_cmb_courses');
    }

    if (!element) return null;

    // Count actual options (excluding the first "--Select--" option)
    const totalOptions = Array.from(element.options).filter(opt => opt.value && opt.value !== "0" && opt.text.trim() !== "").length;
    
    return { element, totalOptions };
}

function getGradeFor(name, exceptions, defaultGrade, formType) {
    if (!name) return defaultGrade;
    
    const itemName = name.toLowerCase().trim();
    console.log(`[DEBUG] Checking item: "${itemName}" against ${exceptions.length} exceptions`);
    updateDebugOverlay(`Checking: "${itemName}"...`, false, formType);

    // Try exact match first
    let exception = exceptions.find(ex => {
        const exName = ex.name.toLowerCase().trim();
        return exName === itemName;
    });
    
    // Try partial match if no exact match
    if (!exception) {
        exception = exceptions.find(ex => {
            const exName = ex.name.toLowerCase().trim();
            // Use a more robust partial match: check if one contains the other
            return itemName.includes(exName) || exName.includes(itemName);
        });
    }
    
    if (exception) {
        console.log(`[DEBUG] MATCH FOUND! Item: "${itemName}", Exception: "${exception.name}", Grade: ${exception.grade}`);
        updateDebugOverlay(`Match: "${exception.name}"`, true, formType, exception.grade);
        return exception.grade;
    }
    
    console.log(`[DEBUG] NO MATCH for "${itemName}". Using default: ${defaultGrade}`);
    updateDebugOverlay(`No Match (Default)`, false, formType, defaultGrade);
    return defaultGrade;
}

async function logEvaluation(name, gradeValue, formType) {
    const gradeMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
    const entry = {
        name: name,
        grade: gradeMap[gradeValue] || gradeValue,
        type: formType,
        time: new Date().toLocaleTimeString()
    };

    const data = await chrome.storage.local.get(['evaluationLog']);
    const log = data.evaluationLog || [];
    log.push(entry);
    await chrome.storage.local.set({ evaluationLog: log });
}

async function fillForm(pageType, dropdown, gradeValue) {
    const grade = parseInt(gradeValue);

    if (pageType === 'Teacher') {
        await fillTeacherForm(dropdown, grade);
    } else if (pageType === 'Online') {
        await fillOnlineForm(dropdown, grade);
    } else if (pageType === 'Course') {
        await fillCourseForm(dropdown, grade);
    }
}

async function fillTeacherForm(dropdown, grade) {
    // Select first teacher
    dropdown.selectedIndex = 1;
    
    // Trigger ASP.NET postback to load courses
    if (typeof __doPostBack !== 'undefined') {
        __doPostBack('ctl00$ContentPlaceHolder2$ddlTeacher', '');
    }

    // Wait for course dropdown to load
    await sleep(1500);

    // Fill radio buttons
    const selector = "#ctl00_ContentPlaceHolder2_q{VAR}_{OPTION}";
    for (let i = 1; i <= 16; i++) {
        const el = document.querySelector(selector.replace("{VAR}", i).replace("{OPTION}", grade));
        if (el) el.click();
    }

    // Fill text areas
    const q20 = document.querySelector("#ctl00_ContentPlaceHolder2_q20");
    const q21 = document.querySelector("#ctl00_ContentPlaceHolder2_q21");
    if (q20) q20.value = "Excellent instruction";
    if (q21) q21.value = "Very well organized";

    // Submit form
    await sleep(500);
    const submitBtn = document.querySelector("#ctl00_ContentPlaceHolder2_btnSave");
    if (submitBtn) {
        console.log('Submitting teacher form...');
        submitBtn.click();
    }
}

async function fillOnlineForm(dropdown, grade) {
    // Select first course
    dropdown.selectedIndex = 1;
    
    // Trigger ASP.NET postback
    if (typeof __doPostBack !== 'undefined') {
        __doPostBack('ctl00$ContentPlaceHolder1$cmb_courses', '');
    }

    // Wait for form to load
    await sleep(1500);

    // Fill radio buttons
    const selector = "#ctl00_ContentPlaceHolder1_q{VAR}_{OPTION}";
    for (let i = 1; i <= 15; i++) {
        const el = document.querySelector(selector.replace("{VAR}", i).replace("{OPTION}", grade));
        if (el) el.click();
    }

    // Fill text area
    const q20 = document.querySelector("#ctl00_ContentPlaceHolder1_q20");
    if (q20) q20.value = "Great online experience";

    // Submit form
    await sleep(500);
    const submitBtn = document.querySelector("#ctl00_ContentPlaceHolder1_btnSave");
    if (submitBtn) {
        console.log('Submitting online form...');
        submitBtn.click();
    }
}

async function fillCourseForm(dropdown, grade) {
    // Select first course
    dropdown.selectedIndex = 1;

    // Fill radio buttons
    const selector = "#ctl00_ContentPlaceHolder2_q{VAR}_{OPTION}";
    for (let i = 1; i <= 12; i++) {
        const el = document.querySelector(selector.replace("{VAR}", i).replace("{OPTION}", grade));
        if (el) el.click();
    }

    // Submit form
    await sleep(500);
    const submitBtn = document.querySelector("#ctl00_ContentPlaceHolder2_btnSave");
    if (submitBtn) {
        console.log('Submitting course form...');
        submitBtn.click();
    }
}

async function moveToNextForm(currentFormType, state) {
    const formOrder = ['Teacher', 'Online', 'Course'];
    const currentIndex = formOrder.indexOf(currentFormType);

    // Check if we've completed all forms
    if (currentIndex === formOrder.length - 1) {
        console.log('🎉 All forms completed!');
        
        // Ensure progress shows 100%
        await chrome.storage.local.set({
            automationProgress: {
                percent: 100,
                detail: '🎉 All forms completed! Opening report...',
                currentForm: 'Complete'
            }
        });

        await chrome.storage.local.set({
            automationState: { isRunning: false, isCompleted: true }
        });

        console.log('✅ Completion state set. User can now view report from popup.');
        return;
    }

    // Move to next form
    const nextForm = formOrder[currentIndex + 1];
    state.currentForm = nextForm;
    state.currentIndex = 0;
    await chrome.storage.local.set({ automationState: state });

    // Navigate to next form
    await navigateToForm(nextForm);
}

async function navigateToForm(formType) {
    console.log(`Navigating to ${formType} form...`);

    const formUrls = {
        'Teacher': 'https://portals.au.edu.pk/qec/p10.aspx',
        'Online': 'https://portals.au.edu.pk/qec/p10a_learning_online_form.aspx',
        'Course': 'https://portals.au.edu.pk/qec/p1.aspx'
    };

    const url = formUrls[formType];
    if (url) {
        window.location.href = url;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
