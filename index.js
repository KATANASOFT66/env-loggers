// Lua Deobfuscator - Client-side deobfuscation engine

let stats = {
    stringsDecoded: 0,
    functionsRenamed: 0,
    junkRemoved: 0,
    sizeReduction: 0
};

/**
 * Main deobfuscation function
 */
function deobfuscate() {
    const input = document.getElementById('input').value;
    const statusEl = document.getElementById('status');
    const statsEl = document.getElementById('stats');
    
    if (!input.trim()) {
        showStatus('Please enter some Lua code to deobfuscate', 'error');
        return;
    }

    try {
        let output = input;
        
        // Reset stats
        stats = {
            stringsDecoded: 0,
            functionsRenamed: 0,
            junkRemoved: 0,
            sizeReduction: 0
        };
        
        const originalSize = output.length;

        // Step 1: Decode string obfuscation (common patterns)
        output = decodeStringTable(output);
        
        // Step 2: Remove junk/dead code
        output = removeJunkCode(output);
        
        // Step 3: Simplify variable names where possible
        output = simplifyVariableNames(output);
        
        // Step 4: Decode base64 encoded strings
        output = decodeBase64Strings(output);
        
        // Step 5: Unwrap self-executing functions
        output = unwrapSelfExecutingFunctions(output);
        
        // Step 6: Format and clean up
        output = formatLuaCode(output);
        
        const newSize = output.length;
        stats.sizeReduction = Math.round(((originalSize - newSize) / originalSize) * 100);
        
        // Display output
        document.getElementById('output').value = output;
        
        // Update stats display
        updateStatsDisplay();
        statsEl.style.display = 'grid';
        
        showStatus('Deobfuscation completed successfully!', 'success');
    } catch (error) {
        showStatus('Error during deobfuscation: ' + error.message, 'error');
        console.error(error);
    }
}

/**
 * Decode string table obfuscation
 * Many obfuscators use a table of strings accessed by index
 */
function decodeStringTable(code) {
    // Pattern: local _ = {"str1", "str2", ...} or similar
    const stringTablePattern = /(?:local\s+)?([a-zA-Z_]\w*)\s*=\s*\{([^}]+)\}/g;
    
    let match;
    while ((match = stringTablePattern.exec(code)) !== null) {
        const tableName = match[1];
        const tableContent = match[2];
        
        // Parse the string array
        const strings = parseStringArray(tableContent);
        
        if (strings.length > 0) {
            // Find usages of this table for string access
            const accessPattern = new RegExp(`${tableName}\\[(\\d+)\\]`, 'g');
            
            code = code.replace(accessPattern, (m, index) => {
                const idx = parseInt(index);
                if (idx >= 0 && idx < strings.length && strings[idx]) {
                    stats.stringsDecoded++;
                    return `"${escapeString(strings[idx])}"`;
                }
                return m;
            });
        }
    }
    
    return code;
}

/**
 * Parse a string array from Lua table syntax
 */
function parseStringArray(content) {
    const strings = [];
    // Match quoted strings
    const stringPattern = /["']([^"']*)["']/g;
    let match;
    
    while ((match = stringPattern.exec(content)) !== null) {
        strings.push(match[1]);
    }
    
    return strings;
}

/**
 * Remove common junk code patterns
 */
function removeJunkCode(code) {
    let result = code;
    
    // Remove empty do...end blocks
    result = result.replace(/\bdo\s*end\b/g, '');
    stats.junkRemoved += (code.length - result.length) / 10;
    
    // Remove redundant parentheses around simple expressions
    let prevResult;
    do {
        prevResult = result;
        result = result.replace(/\(\(([^()]+)\)\)/g, '($1)');
    } while (result !== prevResult);
    
    // Remove unused local declarations (careful with this one)
    result = result.replace(/local\s+_[a-zA-Z0-9_]+\s*=\s*nil\s*;?/g, '');
    stats.junkRemoved += 5;
    
    // Remove debug.sethook calls often used in obfuscation
    result = result.replace(/debug\.sethook\([^)]*\)\s*;?/g, '');
    stats.junkRemoved += 3;
    
    // Remove getfenv/setfenv obfuscation patterns
    result = result.replace(/(getfenv|setfenv)\s*\([^)]*\)\s*;?/g, '');
    stats.junkRemoved += 2;
    
    return result;
}

/**
 * Simplify overly complex variable names
 */
function simplifyVariableNames(code) {
    let result = code;
    
    // Replace long hex-like variable names with shorter ones
    const hexVarPattern = /_\w{8,}/g;
    const matches = result.match(hexVarPattern);
    
    if (matches) {
        const uniqueVars = [...new Set(matches)];
        uniqueVars.forEach((varName, index) => {
            const newName = `_v${index}`;
            const regex = new RegExp(varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            result = result.replace(regex, newName);
            stats.functionsRenamed++;
        });
    }
    
    return result;
}

/**
 * Decode base64 encoded strings within the code
 */
function decodeBase64Strings(code) {
    // Look for patterns like base64.decode("...") or similar
    const base64Pattern = /(?:base64\.decode|fromBase64|b64decode)\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/g;
    
    return code.replace(base64Pattern, (match, b64string) => {
        try {
            const decoded = atob(b64string);
            if (isPrintableString(decoded)) {
                stats.stringsDecoded++;
                return `"${escapeString(decoded)}"`;
            }
        } catch (e) {
            // Not valid base64, leave as is
        }
        return match;
    });
}

/**
 * Check if string contains only printable characters
 */
function isPrintableString(str) {
    return /^[\x20-\x7E\n\r\t]*$/.test(str);
}

/**
 * Escape special characters in strings
 */
function escapeString(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

/**
 * Unwrap self-executing function patterns
 */
function unwrapSelfExecutingFunctions(code) {
    let result = code;
    
    // Pattern: (function() ... end)()
    const selfExecPattern = /\(\s*function\s*\(\s*\)\s*(.*?)\s*end\s*\)\s*\(\s*\)/gs;
    
    result = result.replace(selfExecPattern, (match, content) => {
        return content.trim();
    });
    
    return result;
}

/**
 * Basic Lua code formatting
 */
function formatLuaCode(code) {
    let result = code;
    
    // Normalize whitespace
    result = result.replace(/\t/g, '    ');
    
    // Remove multiple consecutive blank lines
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Fix spacing around operators
    result = result.replace(/\s*([=+\-*/<>])\s*/g, ' $1 ');
    
    // Fix spacing after commas
    result = result.replace(/,\s*/g, ', ');
    
    // Remove trailing whitespace
    result = result.split('\n').map(line => line.trimEnd()).join('\n');
    
    return result.trim();
}

/**
 * Update the statistics display
 */
function updateStatsDisplay() {
    document.getElementById('stringsDecoded').textContent = stats.stringsDecoded;
    document.getElementById('functionsRenamed').textContent = stats.functionsRenamed;
    document.getElementById('junkRemoved').textContent = stats.junkRemoved;
    document.getElementById('sizeReduction').textContent = stats.sizeReduction + '%';
}

/**
 * Show status message
 */
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
    
    setTimeout(() => {
        statusEl.className = 'status';
    }, 5000);
}

/**
 * Clear all fields
 */
function clearAll() {
    document.getElementById('input').value = '';
    document.getElementById('output').value = '';
    document.getElementById('stats').style.display = 'none';
    document.getElementById('status').className = 'status';
}

/**
 * Copy output to clipboard
 */
function copyOutput() {
    const output = document.getElementById('output');
    output.select();
    
    try {
        document.execCommand('copy');
        showStatus('Output copied to clipboard!', 'success');
    } catch (err) {
        // Fallback for modern browsers
        navigator.clipboard.writeText(output.value).then(() => {
            showStatus('Output copied to clipboard!', 'success');
        }).catch(() => {
            showStatus('Failed to copy to clipboard', 'error');
        });
    }
}

// Add keyboard shortcut (Ctrl+Enter to deobfuscate)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        deobfuscate();
    }
});
