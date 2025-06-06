const logger = require('../nexus-core/logger');

module.exports = {
    config: {
        name: "introMessage",
        version: "1.0.0",
        description: "Send intro messages to new participants"
    },
    execute: async function ({ api, event, config }) {
        try {
            // Only process add_participants events
            if (!event || event.type !== 'event' || event.logMessageType !== 'log:subscribe') return;

            // Exit if no participants were added
            const addedParticipants = event.logMessageData?.addedParticipants || [];
            if (addedParticipants.length === 0) return;
            
            // Get thread info
            let threadName = "this group";
            try {
                const threadInfo = await api.getThreadInfo(event.threadID);
                threadName = threadInfo.threadName || "this group";
            } catch (err) {
                logger.error(`Error getting thread info: ${err.message}`);
            }
            
            // Create welcome message
            for (const user of addedParticipants) {
                // Skip if the added participant is the bot itself
                if (user.userFbId === api.getCurrentUserID()) continue;
                
                // Get user name
                let userName = user.fullName || "Friend";
                
                // Create and send welcome message
                const welcomeMessage = `Welcome ${userName} to ${threadName}! 👋\n\nI'm ALEX Bot, your helpful assistant. Use "${config?.prefix || '!'}help" to see what I can do!`;
                
                // Send welcome message with slight delay to avoid rate limits
                setTimeout(() => {
                    api.sendMessage(welcomeMessage, event.threadID)
                      .catch(err => logger.error(`Failed to send welcome message: ${err.message}`));
                }, 1000);
            }
            
        } catch (error) {
            logger.error('Intro message error:', error.message);
        }
    }
};
