const axios = require("axios");
const { ensureDbEntities } = require("../nexus-core/dbSync");

const activeSessions = new Map();

module.exports = {
  config: {
    name: "gagstock",
    shortDescription: "Track Grow A Garden stock with real-time updates",
    guide: "{prefix}gagstock <on | off>",
    role: 0
  },

  run: async function ({ api, event }) {
    try {
      await ensureDbEntities(api, event);
    } catch (error) {
      console.error(`❌ Failed to sync database for user ${event.senderID}:`, error.message);
      await api.sendMessage("⚠️ 𝗘𝗿𝗼𝗿 𝗶𝗻𝗶𝘁𝗶𝗮𝗹𝗶𝘇𝗶𝗻𝗴 𝗱𝗮𝘁𝗮𝗯𝗮𝘀𝗲. 𝗧𝗿𝗮𝗰𝗸𝗶𝗻𝗴 𝗺𝗮𝘆 𝘀𝘁𝗶𝗹𝗹 𝘄𝗼𝗿𝗸 🌱", event.threadID);
    }

    const action = event.body.split(" ")[1]?.toLowerCase();
    const threadID = event.threadID;
    const senderID = event.senderID;

    if (action === "off") {
      const session = activeSessions.get(senderID);
      if (session) {
        clearInterval(session.interval);
        activeSessions.delete(senderID);
        return api.sendMessage("🛑 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸 𝗧𝗿𝗮𝗰𝗸𝗶𝗻𝗴 𝗦𝘁𝗼𝗽𝗽𝗲𝗱 🌿", threadID);
      } else {
        return api.sendMessage("⚠️ 𝗡𝗼 �_A𝗰𝘁𝗶𝘃𝗲 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸 𝗦𝗲𝘀𝘀𝗶𝗼𝗻 🌱", threadID);
      }
    }

    if (action !== "on") {
      return api.sendMessage(
        "📌 𝗨𝘀𝗮𝗴𝗲 𝗚𝘂𝗶𝗱𝗲 🌱\n" +
        "➤ `{prefix}gagstock on` 𝘁𝗼 𝘀𝘁𝗮𝗿𝘁 𝘁𝗿𝗮𝗰𝗸𝗶𝗻𝗴\n" +
        "➤ `{prefix}gagstock off` 𝘁𝗼 𝘀𝘁𝗼𝗽 𝘁𝗿𝗮𝗰𝗸𝗶𝗻𝗴",
        threadID
      );
    }

    if (activeSessions.has(senderID)) {
      return api.sendMessage(
        "📡 𝗔𝗹𝗿𝗲𝗮𝗱𝘆 𝗧𝗿𝗮𝗰𝗸𝗶𝗻𝗴 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸! 🌟 �_U𝘀𝗲 `{prefix}gagstock off` 𝘁𝗼 𝘀𝘁𝗼𝗽.",
        threadID
      );
    }

    await api.sendMessage(
      "✅ 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸 𝗧𝗿𝗮𝗰𝗸𝗶𝗻𝗴 𝗦𝘁𝗮𝗿𝘁𝗲𝗱! 🌿🌱🌿 𝗡𝗼𝘁𝗶𝗳𝗶𝗰𝗮𝘁𝗶𝗼𝗻𝘀 𝗳𝗼𝗿 𝗻𝗲𝘄 𝘀𝘁𝗼𝗰𝗸𝘀 𝗼𝗻𝗹𝘆.",
      threadID
    );

    const getNextUpdateTime = (lastUpdated, intervalSeconds) => {
      const lastUpdate = new Date(lastUpdated || Date.now());
      const nextUpdate = new Date(lastUpdate.getTime() + intervalSeconds * 1000);
      return nextUpdate.toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " PHT";
    };

    const getHoneyNextUpdate = () => {
      const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      nowPH.setHours(nowPH.getHours() + 1, 0, 0, 0);
      return nowPH.toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " PHT";
    };

    const getEggNextUpdate = (lastUpdated) => {
      const lastUpdate = new Date(lastUpdated || Date.now());
      const minutes = lastUpdate.getMinutes();
      const nextHalfHour = minutes < 30 ? 30 : 60;
      const nextUpdate = new Date(lastUpdate);
      nextUpdate.setMinutes(nextHalfHour, 0, 0);
      if (nextHalfHour === 60) nextUpdate.setHours(nextUpdate.getHours() + 1);
      return nextUpdate.toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " PHT";
    };

    const normalizeString = (str) => {
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    };

    const sessionData = {
      interval: null,
      lastStockData: null,
      lastMessage: "",
      lastApiResponses: {},
    };

    const fetchWithRetry = async (url, retries = 3, delay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await axios.get(url, { timeout: 5000 });
          return res.data;
        } catch (error) {
          if (i === retries - 1) {
            console.error(`❌ Failed to fetch ${url}:`, error.message);
            return sessionData.lastApiResponses[url] || null;
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    const fetchAll = async () => {
      try {
        const baseUrl = "https://growagardenstock.vercel.app";
        const [allStock, weather] = await Promise.all([
          fetchWithRetry(`${baseUrl}/api/stock/all`),
          fetchWithRetry(`${baseUrl}/api/weather`),
        ]);

        sessionData.lastApiResponses = {
          [`${baseUrl}/api/stock/all`]: allStock,
          [`${baseUrl}/api/weather`]: weather,
        };

        if (!allStock || !weather) {
          console.error("❌ Incomplete API data, skipping update");
          return;
        }

        const currentStockData = {
          gear: allStock.gear_stock?.items || [],
          seeds: allStock.seeds_stock?.items || [],
          egg: allStock.egg_stock?.items || [],
          honeyStock: allStock.honey_stock?.items || [],
          cosmetics: allStock.cosmetics_stock?.items || [],
          weather: weather.currentWeather || "Unknown",
          weatherIcon: weather.icon || "🌦️",
          cropBonus: weather.cropBonuses || "None",
          gearUpdatedAt: allStock.gear_stock?.last_updated || Date.now(),
          seedsUpdatedAt: allStock.seeds_stock?.last_updated || Date.now(),
          eggUpdatedAt: allStock.egg_stock?.last_updated || Date.now(),
          honeyUpdatedAt: allStock.honey_stock?.last_updated || Date.now(),
          cosmeticsUpdatedAt: allStock.cosmetics_stock?.last_updated || Date.now(),
          weatherUpdatedAt: weather.last_updated || Date.now(),
        };

        const isNewStock = !sessionData.lastStockData ||
          JSON.stringify(currentStockData) !== JSON.stringify(sessionData.lastStockData);

        if (!isNewStock) return;

        sessionData.lastStockData = currentStockData;

        // Countdowns and next updates
        const gearCountdown = allStock.gear_stock?.countdown?.formatted || "0s";
        const seedsCountdown = allStock.seeds_stock?.countdown?.formatted || "0s";
        const eggCountdown = allStock.egg_stock?.countdown?.formatted || "0s";
        const honeyCountdown = allStock.honey_stock?.countdown?.formatted || "0s";
        const cosmeticsCountdown = allStock.cosmetics_stock?.countdown?.formatted || "0s";

        const gearNextUpdate = getNextUpdateTime(allStock.gear_stock?.last_updated, 5 * 60); // 5 min
        const seedsNextUpdate = getNextUpdateTime(allStock.seeds_stock?.last_updated, 5 * 60); // 5 min
        const eggNextUpdate = getEggNextUpdate(allStock.egg_stock?.last_updated); // :00 or :30
        const honeyNextUpdate = getHoneyNextUpdate(); // Next hour
        const cosmeticsNextUpdate = getNextUpdateTime(allStock.cosmetics_stock?.last_updated, 4 * 60 * 60); // 4 hours
        const weatherLastUpdate = new Date(weather.last_updated || Date.now()).toLocaleString("en-US", {
          timeZone: "Asia/Manila",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }) + " PHT";

        // Stock lists with emojis
        const gearList = currentStockData.gear.length
          ? currentStockData.gear.map(item => `  ➤ 🪚 ${item.name} (${item.quantity})`).join("\n")
          : "  ➤ No gear available";
        const seedList = currentStockData.seeds.length
          ? currentStockData.seeds.map(item => `  ➤ 🌼 ${item.name} (${item.quantity})`).join("\n")
          : "  ➤ No seeds available";
        const eggList = currentStockData.egg.length
          ? currentStockData.egg.map(item => `  ➤ 🥚 ${item.name} (${item.quantity})`).join("\n")
          : "  ➤ No eggs available";
        const honeyList = currentStockData.honeyStock.length
          ? currentStockData.honeyStock.map(item => `  ➤ 🍯 ${item.name} (${item.quantity})`).join("\n")
          : "  ➤ No honey stock available";
        const cosmeticsList = currentStockData.cosmetics.length
          ? currentStockData.cosmetics.map(item => `  ➤ ✨ ${item.name} (${item.quantity})`).join("\n")
          : "  ➤ No cosmetics available";

        const weatherText = `${currentStockData.weatherIcon} ${currentStockData.weather}`;

        const message =
          `🌿🌱🌿 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 𝗡𝗼𝘁𝗶𝗳𝗶𝗲𝗿 🌿🌱🌿\n` +
          `═══════════════════════\n\n` +
          `🛠️ 𝗚𝗲𝗮𝗿\n${gearList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${gearNextUpdate}\n⏳ �_R𝗲𝘀𝘁𝗼𝗰𝗸: ${gearCountdown}\n\n` +
          `🌱 𝗦𝗲𝗲𝗱𝘀\n${seedList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${seedsNextUpdate}\n⏳ 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${seedsCountdown}\n\n` +
          `🥚 𝗘𝗴𝗴𝘀\n${eggList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱�_a𝘁𝗲: ${eggNextUpdate}\n⏳ 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${eggCountdown}\n\n` +
          `🎨 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀\n${cosmeticsList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${cosmeticsNextUpdate}\n⏳ 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${cosmeticsCountdown}\n\n` +
          `🍯 𝗛𝗼𝗻𝗲𝘆 𝗦𝘁𝗼𝗰𝗸\n${honeyList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${honeyNextUpdate}\n⏳ 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${honeyCountdown}\n\n` +
          `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿\n  ➤ ${weatherText}\n🪴 𝗖𝗿𝗼𝗽 𝗕𝗼𝗻𝘂𝘀: ${currentStockData.cropBonus}\n⏰ 𝗟𝗮𝘀𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${weatherLastUpdate}\n\n` +
          `🌿🌱🌿 𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗔𝗟𝗘𝗫 𝗕𝗢𝗧 �_V𝟭 🔥\n` +
          `🌿🌱🌿 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝘄𝗶𝘁𝗵 ❤️ 𝗯𝘆 𝗔𝗹𝗲𝘅 𝗝𝗵𝗼𝗻 𝗣𝗼𝗻𝗰𝗲`;

        if (message !== sessionData.lastMessage) {
          sessionData.lastMessage = message;
          await api.sendMessage(message, threadID);
        }
      } catch (err) {
        console.error(`❌ Gagstock error for ${senderID}:`, err.message);
      }
    };

    sessionData.interval = setInterval(fetchAll, 10 * 1000);
    activeSessions.set(senderID, sessionData);
    await fetchAll();
  },
};
