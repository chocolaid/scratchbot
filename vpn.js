const PIA = require('pia');

// Replace these with your actual PIA credentials
const username = 'p8752500';
const password = 'Kn7mR6tDh7';
const region = 'us-east'; // Example region, use your preferred region

async function connectToVPN() {
    try {
        const pia = new PIA(username, password, { region });
        await pia.connect();
        console.log('Connected to PIA VPN');
    } catch (error) {
        console.error('Failed to connect to PIA VPN:', error);
    }
}

async function disconnectFromVPN() {
    try {
        const pia = new PIA(username, password);
        await pia.disconnect();
        console.log('Disconnected from PIA VPN');
    } catch (error) {
        console.error('Failed to disconnect from PIA VPN:', error);
    }
}

// Example usage
(async () => {
    await connectToVPN();
    // Do something while connected to VPN
    await disconnectFromVPN();
})();
