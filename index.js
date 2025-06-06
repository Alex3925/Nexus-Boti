// Import required modules
const http = require('http');
const express = require('express');
const path = require('path');
const fs = require('fs');
const PORT = process.env.PORT || 3000;

// Initialize Express app
const app = express();

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Render.com
app.get('/health', (req, res) => {
  res.status(200).send('Nexus-Bot running');
});

// Fallback for 404 (when no static file or /health is found)
app.use((req, res) => {
  res.status(404).send('Not found');
});

// Create HTTP server with Express
const server = http.createServer(app);

server.on('error', (error) => {
  logger.error(`HTTP server error: ${error.message}`);
});

server.listen(PORT, '0.0.0.0', () => {
  logger.info(startupGradient(`Web server running on port ${PORT}, serving static files from 'public/'`));
});

// ...existing code (unchanged below)
const nexusFca = require('nexus-fca');
const auth = require('./nexus-core/auth');
const logger = require('./nexus-core/logger');
const gradient = require('gradient-string');
const { loadCommands, commands, handleCommand, initializeCommandWatcher } = require('./nexus-core/commandHandler');
const { loadEvents, handleEvent } = require('./nexus-core/eventHandler');
const { initGithub } = require('./nexus-core/githubSync');
const AutoRecovery = require('./nexus-core/autoRecovery');

// Import centralized configuration
const configLoader = require('./nexus-core/configLoader');
// Load configuration early to ensure it's available
const config = configLoader.load();

// Import database initialization
const { initializeDatabase } = require('./nexus-core/initDb');
const { checkDatabaseHealth } = require('./nexus-core/dbInit');
const cleanupDatabase = require('./nexus-core/cleanupDatabase');

// Custom gradient colors 
const mainGradient = gradient(['#FF6B6B', '#4ECDC4']);
const titleGradient = gradient(['#A8E6CF', '#DCEDC1']);
const infoGradient = gradient(['#FFD93D', '#FF6B6B']);
const successGradient = gradient(['#059669', '#10B981']);
const highlightGradient = gradient(['#2563EB', '#3B82F6']);
const separatorGradient = gradient(['#3B82F6', '#60A5FA']);
const startupGradient = gradient(['#FFD93D', '#FF6B6B']);

// Restore large ASCII logo/banner
const logo = `
╔═════════════════════════════════════════════╗
║                                             ║
║                                             ║
║ ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗ ║
║ ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝ ║
║ ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗ ║
║ ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║ ║
║ ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║ ║
║ ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ║
║                                             ║   
║           Nexus Bot - Ignition X            ║
╚═════════════════════════════════════════════╝`;

// Compact logo/banner for professional startup
const compactLogo = highlightGradient('Nexus Bot') + ' ' + mainGradient('•') + ' ' + infoGradient('Ignition X');

// Define boot phases
const BOOT_PHASES = {
  INIT: '📋 INITIALIZATION',
  DATABASE: '🗄️ DATABASE',
  SYSTEM: '⚙️ SYSTEM',
  MODULES: '🧩 MODULES',
  COMMANDS: '🔧 COMMANDS',
  NETWORK: '🌐 NETWORK',
  READY: '✅ READY'
};

// Custom log format for startup phases
function logPhase(phase, message) {
  const phaseLabel = startupGradient(`[${phase.replace(/[^A-Z]/g, '')}]`);
  console.log(`${phaseLabel} ${message}`);
}

function logStep(icon, message, status = null) {
  let statusText = '';
  if (status === 'success') statusText = startupGradient('✓');
  else if (status === 'warning') statusText = startupGradient('!');
  else if (status === 'error') statusText = startupGradient('✗');
  else if (status === 'info') statusText = startupGradient('i');
  console.log(`${startupGradient('-')} ${message} ${statusText}`);
}

// Loading animation frames
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let frameIndex = 0;

function displayLoadingAnimation(message) {
  process.stdout.write('\r' + infoGradient(frames[frameIndex]) + ' ' + message);
  frameIndex = (frameIndex + 1) % frames.length;
}

// Display startup message
async function displayStartup(account, uid, prefix, commandCount, customPrefixCount) {
  console.clear();
  console.log(startupGradient(logo));
  console.log(startupGradient('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(startupGradient(' Nexus Bot - A Advanced Bot For Facebook Messenger'));
  console.log(startupGradient(' Author: NexusTeam'));
  console.log(startupGradient(' Version: ') + require('./package.json').version + '   Codename: Ignition X');
  console.log(startupGradient(' Automate the Grind. Dominate the Flow.'));
  console.log(startupGradient('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  console.log(startupGradient(' Status: Online ✓'));
  console.log(startupGradient(' Account: ') + account);
  console.log(startupGradient(' UID: ') + uid);
  console.log(startupGradient(' Prefix: ') + prefix);
  console.log(startupGradient(' Commands: ') + commandCount);
  if (customPrefixCount > 0) {
    console.log(startupGradient(' Custom Thread Prefixes: ') + customPrefixCount);
  }
  console.log(startupGradient('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

// Notify all admins on critical errors
async function notifyAllAdmins(message) {
  try {
    const config = global.config || {};
    const admins = Array.isArray(config.admins) ? config.admins : [];
    if (!global.api || !admins.length) return;
    for (const adminId of admins) {
      try {
        await global.api.sendMessage(message, adminId);
      } catch (e) {
        if (e && (e.errorSummary === 'Thread Disabled' || (e.errorDescription && e.errorDescription.includes('thread is disabled')))) {
          logger.info(`Admin inbox for ${adminId} is disabled, skipping notification.`);
        } else {
          logger.debug(`Failed to notify admin ${adminId}: ${e.message || e}`);
        }
      }
    }
  } catch (e) {
    logger.error('Failed to notify all admins:', e);
  }
}

// Initialize and run the bot
async function initBot() {
  try {
    logger.info('Starting Nexus Bot initialization...');
    
    logPhase(BOOT_PHASES.INIT, 'Loading critical configuration...');
    if (!configLoader.load()) {
      throw new Error('Failed to load critical configuration');
    }

    logPhase(BOOT_PHASES.DATABASE, 'Initializing database...');
    const dbInitializer = require('./nexus-core/dbInitializer');
    const dbSuccess = await dbInitializer.initialize();
    if (!dbSuccess) {
      logger.warn('Database initialization failed, running in fallback mode');
    }

    logPhase(BOOT_PHASES.SYSTEM, 'Initializing permission system...');
    const permissionManager = require('./nexus-core/permissionManager')(config);
    global.permissionManager = permissionManager;
    const permSuccess = await permissionManager.initialize();
    if (!permSuccess) {
      throw new Error('Failed to initialize permission system');
    }

    logPhase(BOOT_PHASES.SYSTEM, 'Setting up safety limits...');
    global.messageRateLimit = global.messageRateLimit || new Map();
    global.commandCooldowns = global.commandCooldowns || new Map();

    global.client = {
      commands: new Map(),
      events: new Map(),
      cooldowns: new Map(),
      eventRegistered: {},
      handleReply: [],
      handleReaction: [],
      handleSchedule: [],
      messageQueue: [],
    };

    const loadingInterval = setInterval(() => {
      displayLoadingAnimation('Initializing Nexus Bot...');
    }, 100);

    try {
      ['logs', 'database', 'commands', 'events', 'public'].forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        !fs.existsSync(dirPath) && fs.mkdirSync(dirPath);
      });

      clearInterval(loadingInterval);
      process.stdout.write('\n');

      logPhase(BOOT_PHASES.DATABASE, 'Initializing database...');
      let dbInitialized = false;
      try {
        await dbInitializer.initialize();
        await dbInitializer.migrateDataFromFiles();
        dbInitialized = true;
      } catch (dbError) {
        logger.warn('Database initialization issue:', dbError.message);
        logger.info('Continuing with limited database functionality');
      }

      logPhase(BOOT_PHASES.INIT, 'Initializing system...');
      const InitSystem = require('./nexus-core/initSystem');
      if (dbInitialized) {
        await InitSystem.initialize();
      } else {
        await InitSystem.initializeFromFiles();
      }

      logPhase(BOOT_PHASES.COMMANDS, 'Loading commands...');
      loadCommands();

      logPhase(BOOT_PHASES.COMMANDS, 'Initializing command watcher...');
      initializeCommandWatcher();

      logPhase(BOOT_PHASES.COMMANDS, 'Loading events...');
      loadEvents();

      global.notificationDisabled = false;
      global.notificationFailCount = 0;

      logPhase(BOOT_PHASES.SYSTEM, 'Initializing permission system...');
      await permissionManager.initialize();

      if (config?.github?.enabled) {
        logPhase(BOOT_PHASES.MODULES, 'Initializing GitHub integration...');
        initGithub(config.github);
      }

      const cache = require('./nexus-core/cache');
      global.messageCache = cache;

      global.configLoader = configLoader;
      global.config = config;

      global.messageCount = 0;

      if (!global.threadPrefixes) {
        global.threadPrefixes = new Map();
        try {
          const prefixPath = path.join(__dirname, 'database/prefixes.json');
          if (fs.existsSync(prefixPath)) {
            const prefixes = JSON.parse(fs.readFileSync(prefixPath, 'utf8'));
            Object.entries(prefixes).forEach(([threadID, prefix]) => {
              global.threadPrefixes.set(threadID, prefix);
            });
            logger.info(`Loaded ${global.threadPrefixes.size} custom thread prefixes`);
          }
        } catch (error) {
          logger.error("Error loading thread prefixes:", error);
        }
      }

      logPhase(BOOT_PHASES.NETWORK, 'Logging in to Facebook...');
      let api;
      try {
        api = await auth.loginWithRetry();
        global.api = api;
      } catch (loginError) {
        logger.error('Fatal login error:', loginError.message);
        throw new Error(`Failed to login: ${loginError.message}`);
      }

      await AutoRecovery.checkRestartMarker(api);

      const userInfo = await api.getCurrentUserID();
      const userName = (await api.getUserInfo(userInfo))[userInfo].name;

      api.commands = commands;

      await displayStartup(userName, userInfo, config.prefix, commands.size, global.threadPrefixes ? global.threadPrefixes.size : 0);

      api.listenMqtt((err, message) => {
        if (err) {
          logger.error("MQTT Error:", err);
          Optimization.trackError(err);
          return;
        }

        if (message && message.type === "message" && message.body) {
          logger.debug(`Received message: "${message.body}" from ${message.senderID} in ${message.threadID}`);
        }

        try {
          if (message && message.body && message.body.startsWith(config.prefix || '!')) {
            const min = config?.system?.performance?.commandDelay?.min || 500;
            const max = config?.system?.performance?.commandDelay?.max || 2000;
            const delay = Math.floor(Math.random() * (max - min + 1)) + min;

            logger.debug(`Processing command: ${message.body}`);

            setTimeout(() => {
              try {
                handleCommand(api, message);
              } catch (cmdError) {
                logger.error("Command processing error:", cmdError);
              }
            }, delay);
          }

          try {
            handleEvent(api, message);
          } catch (eventError) {
            logger.error("Event processing error:", eventError);
          }
        } catch (error) {
          logger.error("Message handling error:", error);
          Optimization.trackError(error);
        }
      });

    } catch (error) {
      if (global.Optimization) {
        global.Optimization.trackError(error);
      }
      clearInterval(loadingInterval);
      console.log(gradient(['#DC2626', '#EF4444'])('\n❌ Error: ') + error.message);
      process.exit(1);
    }
  } catch (error) {
    logger.error('Critical initialization error:', error);
    process.exit(1);
  }
}

// Add safety checks for process termination
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await cleanup();
  process.exit(0);
});

// Add cleanup function
async function cleanup() {
  try {
    if (global.db) await global.db.close();
    if (global.threadPrefixes) {
      await saveThreadPrefixes();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('HTTP server closed');
    }
    logger.info('Cleanup completed successfully');
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

// Save thread prefixes
async function saveThreadPrefixes() {
  try {
    const prefixPath = path.join(__dirname, 'database/prefixes.json');
    const prefixes = Object.fromEntries(global.threadPrefixes);
    fs.writeFileSync(prefixPath, JSON.stringify(prefixes, null, 2));
    logger.info('Thread prefixes saved successfully');
  } catch (error) {
    logger.error('Error saving thread prefixes:', error);
  }
}

// Database health check and cleanup
(async () => {
  try {
    await checkDatabaseHealth();
    await cleanupDatabase();
  } catch (error) {
    console.error('Database initialization or cleanup failed:', error);
    process.exit(1);
  }
})();

(async () => {
  try {
    await initializeDatabase();
    await initBot();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
})();

// Handle exit
process.on('SIGINT', () => {
  console.log(successGradient('\n\nShutting down Nexus Bot...\n'));
  process.exit(0);
});

process.on('exit', (code) => {
  if (code === 1) {
    logger.info('Exiting for restart...');
  } else if (code === 2) {
    logger.info('Exiting after update...');
  }
});

process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await notifyAllAdmins(`❗ Uncaught Exception:\n${error.stack || error}`);
  if (global.AutoRecovery) {
    AutoRecovery.trackError(error);
  }
  if (global.adminNotifier) {
    await global.adminNotifier.notifyError(error, {
      source: 'Uncaught Exception',
      critical: true
    });
  }
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await notifyAllAdmins(`❗ Unhandled Promise Rejection:\n${reason}`);
  if (global.adminNotifier) {
    await global.adminNotifier.notifyError(reason, {
      source: 'Unhandled Promise Rejection',
      critical: true
    });
  }
});
