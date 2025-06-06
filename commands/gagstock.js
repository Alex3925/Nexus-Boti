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
      api.sendMessage("⚠️ 𝗘𝗿𝗿𝗼𝗿 𝗶𝗻𝗶𝘁𝗶𝗮𝗹𝗶𝘇𝗶𝗻𝗴 �_d𝗮𝘁𝗮𝗯𝗮𝘀𝗲. 𝗧�_r𝗮𝗰𝗸𝗶𝗻𝗴 𝗺𝗮𝘆 𝘀𝘁𝗶𝗹𝗹 𝘄𝗼𝗿𝗸 🌱", event.threadID);
    }

    const action = event.body.split(" ")[1]?.toLowerCase();
    const threadID = event.threadID;
    const senderID = event.senderID;

    if (action === "off") {
      const session = activeSessions.get(senderID);
      if (session) {
        clearInterval(session.interval);
        activeSessions.delete(senderID);
        return api.sendMessage("🛑 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸 𝗧�_r𝗮𝗰𝗸𝗶𝗻𝗴 𝗦𝘁𝗼𝗽𝗽𝗲𝗱 🌿", threadID);
      } else {
        return api.sendMessage("⚠️ 𝗡𝗼 𝗔𝗰𝘁𝗶𝘃𝗲 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸 𝗦𝗲𝘀𝘀𝗶𝗼𝗻 🌱", threadID);
      }
    }

    if (action !== "on") {
      return api.sendMessage(
        "📌 𝗨𝘀𝗮𝗴𝗲 𝗚𝘂𝗶𝗱𝗲 🌱\n" +
        "➤ `{prefix}gagstock on` 𝘁𝗼 𝘀𝘁𝗮𝗿𝘁 𝘁�_r𝗮𝗰𝗸𝗶𝗻�_g\n" +
        "➤ `{prefix}gagstock off` 𝘁𝗼 𝘀𝘁𝗼𝗽 𝘁�_r𝗮𝗰�_k𝗶𝗻𝗴",
        threadID
      );
    }

    if (activeSessions.has(senderID)) {
      return api.sendMessage(
        "📡 𝗔𝗹�_r𝗲𝗮𝗱𝘆 𝗧�_r𝗮𝗰𝗸𝗶𝗻𝗴 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸! 🌟 �_U𝘀𝗲 `{prefix}gagstock off` 𝘁𝗼 𝘀𝘁𝗼𝗽.",
        threadID
      );
    }

    api.sendMessage(
      "✅ 𝗚𝗮𝗴𝘀𝘁𝗼𝗰𝗸 𝗧�_r𝗮𝗰𝗸𝗶𝗻�_g 𝗦𝘁𝗮�_r𝘁𝗲𝗱! 🌿🌱🌿 𝗡𝗼𝘁𝗶𝗳𝗶𝗰𝗮𝘁𝗶𝗼𝗻𝘀 𝗳𝗼�_r 𝗻𝗲𝘄 𝘀𝘁𝗼𝗰𝗸𝘀 𝗼𝗻𝗹𝘆.",
      threadID
    );

    const convertTime = (ms) => {
      if (ms <= 0) return "0s";
      const seconds = Math.floor(ms / 1000);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
    };

    const getNextUpdateTime = (updatedAt, intervalSeconds) => {
      const lastUpdate = updatedAt ? new Date(updatedAt) : new Date();
      const nextUpdate = new Date(lastUpdate.getTime() + intervalSeconds * 1000);
      return nextUpdate.toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " PHT";
    };

    const getHoneyRestockCountdown = () => {
      const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const currentMinutes = nowPH.getMinutes();
      const currentSeconds = nowPH.getSeconds();
      const remainingMinutes = 59 - currentMinutes;
      const remainingSeconds = 60 - currentSeconds;
      const totalSeconds = remainingMinutes * 60 + remainingSeconds;
      return convertTime(Math.max(0, totalSeconds * 1000));
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
        const [
          gearSeed,
          egg,
          weather,
          honey,
          cosmetics,
          seedsEmoji,
        ] = await Promise.all([
          fetchWithRetry("https://growagardenstock.com/api/stock?type=gear-seeds"),
          fetchWithRetry("https://growagardenstock.com/api/stock?type=egg"),
          fetchWithRetry("https://growagardenstock.com/api/stock/weather"),
          fetchWithRetry("http://65.108.103.151:22377/api/stocks?type=honeyStock"),
          fetchWithRetry("https://growagardenstock.com/api/special-stock?type=cosmetics"),
          fetchWithRetry("http://65.108.103.151:22377/api/stocks?type=seedsStock"),
        ]);

        sessionData.lastApiResponses = {
          "https://growagardenstock.com/api/stock?type=gear-seeds": gearSeed,
          "https://growagardenstock.com/api/stock?type=egg": egg,
          "https://growagardenstock.com/api/stock/weather": weather,
          "http://65.108.103.151:22377/api/stocks?type=honeyStock": honey,
          "https://growagardenstock.com/api/special-stock?type=cosmetics": cosmetics,
          "http://65.108.103.151:22377/api/stocks?type=seedsStock": seedsEmoji,
        };

        if (!gearSeed || !egg || !weather || !honey || !cosmetics) {
          console.error("❌ Incomplete API data, skipping update");
          return;
        }

        const currentStockData = {
          gear: gearSeed.gear || [],
          seeds: gearSeed.seeds || [],
          egg: egg.egg || [],
          weather: weather.currentWeather || "Unknown",
          weatherIcon: weather.icon || "🌦️",
          cropBonus: weather.cropBonuses || "None",
          honeyStock: honey.honeyStock || [],
          cosmetics: cosmetics.cosmetics || [],
          gearUpdatedAt: gearSeed.updatedAt || Date.now(),
          eggUpdatedAt: egg.updatedAt || Date.now(),
          cosmeticsUpdatedAt: cosmetics.updatedAt || Date.now(),
        };

        const isNewStock = !sessionData.lastStockData ||
          JSON.stringify(currentStockData) !== JSON.stringify(sessionData.lastStockData);

        if (!isNewStock) return;

        sessionData.lastStockData = currentStockData;

        const gearRestock = convertTime(Math.max(0, (300 - Math.floor((Date.now() - (gearSeed.updatedAt || Date.now())) / 1000)) * 1000));
        const eggRestock = convertTime(Math.max(0, (600 - Math.floor((Date.now() - (egg.updatedAt || Date.now())) / 1000)) * 1000));
        const cosmeticsRestock = convertTime(Math.max(0, (14400 - Math.floor((Date.now() - (cosmetics.updatedAt || Date.now())) / 1000)) * 1000));
        const honeyRestock = getHoneyRestockCountdown();

        const gearNextUpdate = getNextUpdateTime(gearSeed.updatedAt || Date.now(), 300);
        const eggNextUpdate = getNextUpdateTime(egg.updatedAt || Date.now(), 600);
        const cosmeticsNextUpdate = getNextUpdateTime(cosmetics.updatedAt || Date.now(), 14400);
        const honeyNextUpdate = getHoneyNextUpdate();
        const weatherLastUpdate = new Date().toLocaleString("en-US", {
          timeZone: "Asia/Manila",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }) + " PHT";

        const emojiSeeds = honey.seedsStock || [];
        const gearList = currentStockData.gear.length ? currentStockData.gear.map(item => `  ➤ 🪚 ${item}`).join("\n") : "  ➤ No gear available";
        const seedList = currentStockData.seeds.length ? currentStockData.seeds.map(seed => {
          const name = seed.split(" **")[0];
          const matched = emojiSeeds.find(s => normalizeString(s.name) === normalizeString(name));
          const emoji = matched?.emoji || "🌼";
          return `  ➤ ${emoji} ${seed}`;
        }).join("\n") : "  ➤ No seeds available";
        const eggList = currentStockData.egg.length ? currentStockData.egg.map(item => `  ➤ 🥚 ${item}`).join("\n") : "  ➤ No eggs available";
        const cosmeticsList = currentStockData.cosmetics.length ? currentStockData.cosmetics.map(item => `  ➤ ✨ ${item}`).join("\n") : "  ➤ No cosmetics available";
        const honeyList = currentStockData.honeyStock.length ? currentStockData.honeyStock.map(h => `  ➤ 🍯 ${h.name}: ${h.value}`).join("\n") : "  ➤ No honey stock available";

        const weatherText = `${currentStockData.weatherIcon} ${currentStockData.weather}`;

        const message =
          `🌿🌱🌿 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 𝗧𝗿𝗮𝗰𝗸𝗲𝗿 🌿🌱🌿\n` +
          `═══════════════════════\n\n` +
          `🛠️ �_G𝗲𝗮𝗿\n${gearList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${gearNextUpdate}\n⏳ �_R𝗲𝘀𝘁𝗼𝗰𝗸: ${gearRestock}\n\n` +
          `🌱 𝗦𝗲𝗲𝗱𝘀\n${seedList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${gearNextUpdate}\n⏳ 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${gearRestock}\n\n` +
          `🥚 𝗘𝗴𝗴𝘀\n${eggList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${eggNextUpdate}\n⏳ 𝗥𝗲𝘀𝘁𝗼𝗰𝗸: ${eggRestock}\n\n` +
          `🎨 �_C𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀\n${cosmeticsList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${cosmeticsNextUpdate}\n⏳ �_R𝗲𝘀𝘁𝗼𝗰𝗸: ${cosmeticsRestock}\n\n` +
          `🍯 �_H𝗼𝗻𝗲𝘆 𝗦𝘁𝗼𝗰𝗸\n${honeyList}\n⏰ 𝗡𝗲𝘅𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${honeyNextUpdate}\n⏳ �_R𝗲𝘀𝘁𝗼𝗰𝗸: ${honeyRestock}\n\n` +
          `🌤️ �_W𝗲𝗮𝘁𝗵𝗲𝗿\n  ➤ ${weatherText}\n🪴 �_C𝗿𝗼𝗽 𝗕𝗼𝗻𝘂𝘀: ${currentStockData.cropBonus}\n⏰ �_L𝗮𝘀𝘁 �_U𝗽𝗱𝗮𝘁𝗲: ${weatherLastUpdate}\n\n` +
          `🌿🌱🌿 �_P𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗔𝗟𝗘𝗫 𝗕𝗢𝗧 �_V𝟭 🔥\n` +
          `🌿🌱🌿 �_C𝗿𝗲𝗮𝘁𝗲𝗱 𝘄𝗶𝘁𝗵 ❤️ 𝗯𝘆 𝗔𝗹𝗲𝘅 �_J𝗵𝗼𝗻 �_P𝗼𝗻𝗰𝗲`;

        if (message !== sessionData.lastMessage) {
          sessionData.lastMessage = message;
          api.sendMessage(message, threadID);
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
