// Minimal HTTP server for Render.com health checks
const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('Nexus-Bot running');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.on('error', (error) => {
  logger.error(`HTTP server error: ${error.message}`);
});

server.listen(PORT, '0.0.0.0', () => {
  logger.info(startupGradient(`Health check web server running on port ${PORT}`));
});

// ...existing code
const nexusFca = require('nexus-fca');
const auth = require('./nexus-core/auth');
const logger = require('./nexus-core/logger');
const gradient = require('gradient-string');
const { loadCommands, commands, handleCommand, initializeCommandWatcher } = require('./nexus-core/commandHandler');
const { loadEvents, handleEvent } = require('./nexus-core/eventHandler');
const fs = require('fs');
const path = require('path');
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

const successGradient = gradient([
  '#059669', // emerald
  '#10B981'  // green
]);

const highlightGradient = gradient([
  '#2563EB', // blue
  '#3B82F6'  // lighter blue
]);

const separatorGradient = gradient([
  '#3B82F6', // blue
  '#60A5FA'  // lighter blue
]);

// New universal gradient for all startup log lines
const startupGradient = gradient(['#FFD93D', '#FF6B6B']); // yellow to red

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

// Define a set of professional boot phases for organized startup
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
  // Use a compact, colorized single-line format
  const phaseLabel = startupGradient(`[${phase.replace(/[^A-Z]/g, '')}]`);
  console.log(`${phaseLabel} ${message}`);
}

function logStep(icon, message, status = null) {
  // Use a compact, colorized single-line format for steps
  let statusText = '';
  if (status === 'success') statusText = startupGradient('✓');
  else if (status === 'warning') statusText = startupGradient('!');
  else if (status === 'error') statusText = startupGradient('✗');
  else if (status === 'info') statusText = startupGradient('i');
  console.log(`${startupGradient('-')} ${message} ${statusText}`);
}

// Loading animation frames with cyan color
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let frameIndex = 0;

function displayLoadingAnimation(message) {
  process.stdout.write('\r' + infoGradient(frames[frameIndex]) + ' ' + message);
  frameIndex = (frameIndex + 1) % frames.length;
}

// Restore multi-line displayStartup with tagline
async function displayStartup(account, uid, prefix, commandCount, customPrefixCount) {
  console.clear();
  console.log(startupGradient(logo));
  console.log(startupGradient('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(startupGradient(' Nexus Bot - A Advanced Bot For Facebook Messenger'));
  console.log(startupGradient(' Author: NexusTeam'));
  console.log(startupGradient(' Version: ') + require('./package.json').version + '   Codename: Ignition X');
  // Tagline with gradient color
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
        // Clean handling for disabled threads
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
    // 1. First initialize logger and error tracking
    logger.info('Starting Nexus Bot initialization...');
    
    // 2. Load critical configuration first
    logPhase(BOOT_PHASES.INIT, 'Loading critical configuration...');
    if (!configLoader.load()) {
      throw new Error('Failed to load critical configuration');
    }

    // 3. Initialize optimization and monitoring early
    const Optimization = require('./nexus-core/optimization');
    global.Optimization = Optimization;
    await Optimization.initErrorTracking();
    await Optimization.startMemoryMonitor();

    // 4. Initialize database connection and safety checks
    logPhase(BOOT_PHASES.DATABASE, 'Initializing database...');
    const dbInitializer = require('./nexus-core/dbInitializer');
    const dbSuccess = await dbInitializer.initialize();
    if (!dbSuccess) {
      logger.warn('Database initialization failed, running in fallback mode');
    }

    // 5. Initialize permission system (critical for security)
    logPhase(BOOT_PHASES.SYSTEM, 'Initializing permission system...');
    const permissionManager = require('./nexus-core/permissionManager')(config);
    global.permissionManager = permissionManager;
    const permSuccess = await permissionManager.initialize();
    if (!permSuccess) {
      throw new Error('Failed to initialize permission system');
    }

    // 6. Initialize safety limiters and rate limits
    logPhase(BOOT_PHASES.SYSTEM, 'Setting up safety limits...');
    global.messageRateLimit = global.messageRateLimit || new Map();
    global.commandCooldowns = global.commandCooldowns || new Map();

    // Initialize global handlers
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

    // Only after safety systems are ready, load remaining components
    const loadingInterval = setInterval(() => {
      displayLoadingAnimation('Initializing Nexus Bot...');
    }, 100);

    try {
      // Create required directories
      ['logs', 'database', 'commands', 'events'].forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        !fs.existsSync(dirPath) && fs.mkdirSync(dirPath);
      });

      // Initialize components with loading animation
      clearInterval(loadingInterval);
      
      process.stdout.write('\n');
      
      // First initialize the database before anything else
      logPhase(BOOT_PHASES.DATABASE, 'Initializing database...');
      let dbInitialized = false;
      try {
        const dbInitializer = require('./nexus-core/dbInitializer');
        await dbInitializer.initialize();
        dbInitialized = true;
        
        // Attempt to migrate data from JSON files if needed
        await dbInitializer.migrateDataFromFiles();
      } catch (dbError) {
        logger.warn('Database initialization issue:', dbError.message);
        logger.info('Continuing with limited database functionality');
      }
      
      // Now initialize global system components AFTER database is ready
      logPhase(BOOT_PHASES.INIT, 'Initializing system...');
      const InitSystem = require('./nexus-core/initSystem');
      if (dbInitialized) {
        // Load from database if it was initialized successfully
        await InitSystem.initialize();
      } else {
        // Fall back to loading since JSON files
        await InitSystem.initializeFromFiles();
      }
      
      // Load commands and events before login
      logPhase(BOOT_PHASES.COMMANDS, 'Loading commands...');
      loadCommands();
      
      logPhase(BOOT_PHASES.COMMANDS, 'Initializing command watcher...');
      initializeCommandWatcher();
      
      logPhase(BOOT_PHASES.COMMANDS, 'Loading events...');
      loadEvents();
      
      // Set up global notification state tracking
      global.notificationDisabled = false;
      global.notificationFailCount = 0;
      
      // Initialize permission manager
      logPhase(BOOT_PHASES.SYSTEM, 'Initializing permission system...');
      const permissionManager = require('./nexus-core/permissionManager')(config);
      global.permissionManager = permissionManager;
      await permissionManager.initialize();

      // Use optional chaining for all config accesses to prevent 'undefined' errors
      if (config?.github?.enabled) {
        logPhase(BOOT_PHASES.MODULES, 'Initializing GitHub integration...');
        initGithub(config.github);
      }

      // Create a global cache that can be cleared during optimization
      const cache = require('./nexus-core/cache');
      global.messageCache = cache;
      
      // Make config available globally using the configLoader instance
      global.configLoader = configLoader;
      global.config = config;
      
      // Initialize global message counter
      global.messageCount = 0;
      
      // Initialize thread prefixes map if not exists
      if (!global.threadPrefixes) {
        global.threadPrefixes = new Map();
        
        // Load saved prefixes
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
      
      // Login to Facebook with more robust error handling
      logPhase(BOOT_PHASES.NETWORK, 'Logging in to Facebook...');
      let api;
      try {
        api = await auth.loginWithRetry();
        global.api = api; // Make API globally available
      } catch (loginError) {
        logger.error('Fatal login error:', loginError.message);
        throw new Error(`Failed to login: ${loginError.message}`);
      }
      
      // Check for restart markers and handle recovery
      await AutoRecovery.checkRestartMarker(api);
      
      const userInfo = await api.getCurrentUserID();
      const userName = (await api.getUserInfo(userInfo))[userInfo].name;

      // Add commands to api object
      api.commands = commands;

      // Success message
      await displayStartup(userName, userInfo, config.prefix, commands.size, global.threadPrefixes ? global.threadPrefixes.size : 0);

      // Start listening with improved error handling
      api.listenMqtt((err, message) => {
        if (err) {
          logger.error("MQTT Error:", err);
          Optimization.trackError(err);
          return;
        }
        
        // Log incoming messages for debugging
        if (message && message.type === "message" && message.body) {
          logger.debug(`Received message: "${message.body}" from ${message.senderID} in ${message.threadID}`);
        }
        
        // Process commands with robust error handling
        try {
          if (message && message.body && message.body.startsWith(config.prefix || '!')) {
            // Get delay configuration with fallbacks
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
          
          // Process events with separate error handling
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
      // Track error for potential auto-restart using the Optimization module
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
    // Clean up database connections
    if (global.db) await global.db.close();
    
   robot

// Save any pending data
    if (global.threadPrefixes) {
      // Save thread prefixes
      await saveThreadPrefixes();
    }
    
    // Close HTTP server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('HTTP server closed');
    }
    
    logger.info('Cleanup completed successfully');
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

// Call database health check and cleanup during initialization
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
    // Continue with bot startup
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

// Handle different exit codes
process.on('exit', (code) => {
  if (code === 1) {
    logger.info('Exiting for restart...');
  } else if (code === 2) {
    logger.info('Exiting after update...');
  }
});

// Handle uncaught exceptions for auto-restart
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

// Handle unhandled promise rejections for auto-restart
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

// Setup error handling and admin notifications
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

process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await notifyAllAdmins(`❗ Uncaught Exception:\n${error.stack || error}`);
  if (global.adminNotifier) {
    await global.adminNotifier.notifyError(error, {
      source: 'Uncaught Exception',
      critical: true
    });
  }
  
  // Wait for notification to be sent before potentially exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});
